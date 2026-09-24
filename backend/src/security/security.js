import path from 'path';
import { fileURLToPath } from 'url';
import Utils from '../utils/utils.js';
import DBMS from '../dbms/dbms.js';
import resolveExecutable from "../bo/method_resolver.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class Security {
  static instance;

  constructor() {
    if (Security.instance) return Security.instance;

    this.permissions = new Map();
    this.userProfiles = new Map();
    this.transactions = new Map();
    this.utils = new Utils();
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
    this.reflect = Reflect;
    Security.instance = this;
  }

  normalizePermission(permission = {}) {
    const normalize = (value) => String(value ?? '').trim();

    return {
      sub_system: normalize(permission.sub_system),
      class: normalize(permission.class ?? permission.class_name),
      method: normalize(permission.method ?? permission.method_name),
      profile: normalize(permission.profile ?? permission.profile_name),
      parameter: permission.parameter,
    };
  }

  buildPermissionKey(permission = {}) {
    const normalized = this.normalizePermission(permission);
    return [
      normalized.sub_system.toLowerCase(),
      normalized.class.toLowerCase(),
      normalized.method.toLowerCase(),
      normalized.profile.toLowerCase(),
    ].join('::');
  }

  async syncPermissions() {
    await this.dbmsReady;
    await this.dbms.executeNamedQuery({
      nameQuery: 'ensureTransactionSerial',
    });

    const csvPermissions = await this.getPermissionsFile();
    const dbPermissions = await this.getPermissionsDB();

    for (const [key, csvPermission] of csvPermissions) {
      if (dbPermissions.has(key)) continue;

      await this.dbms.executeNamedQuery({
        nameQuery: 'insertPermission',
        params: {
          sub_system: csvPermission.sub_system,
          class_name: csvPermission.class,
          method_name: csvPermission.method,
          profile_name: csvPermission.profile,
        },
      });

      dbPermissions.set(key, csvPermission);
    }

    this.permissions = new Map(dbPermissions);

    // Sincronizar perfiles de usuario
    await this.syncUserProfiles();

    return this.permissions;
  }

  // El frontend llama a cada función por NÚMERO (transaction_id fijo en los
  // *Service.js), y ese número es el id de la tabla "transaction". Antes
  // cada base lo asignaba por orden de llegada, así que dos computadoras
  // con historias distintas terminaban con numeraciones distintas (pasó el
  // 24/09/2026 al traer la rama Julio a la laptop de la oficina: "listar
  // alertas" era 125 en una y 126 en la otra). Esto deja cada transacción
  // con el id que dice permission.csv, que pasa a ser la única fuente de
  // verdad. Ninguna tabla tiene FK hacia transaction.id, así que es seguro.
  // Corre solo al arrancar (server.init), no en el refresco de cada minuto.
  async alignTransactionIds() {
    await this.dbmsReady;
    const csvPath = process.env.PERMISSIONS_FILE_PATH
      ? path.resolve(process.env.PERMISSIONS_FILE_PATH)
      : path.resolve(__dirname, '../../config/permission.csv');
    const csvRows = [...(await this.utils.readCSV(csvPath)).values()];

    const nameKey = (s, c, m) => [s, c, m].map((v) => String(v ?? '').trim().toLowerCase()).join('::');
    const deseado = new Map();
    for (const row of csvRows) {
      const id = Number(row.id);
      const key = nameKey(row.sub_system, row.class ?? row.class_name, row.method ?? row.method_name);
      if (Number.isInteger(id) && id > 0 && !deseado.has(key)) deseado.set(key, id);
    }

    const client = await this.dbms.pool.connect();
    try {
      const { rows } = await client.query(
        'SELECT t.id, s.name AS s, c.name AS c, m.name AS m FROM public."transaction" t JOIN public.subsystem s ON s.id = t.subsystem_id JOIN public."class" c ON c.id = t.class_id JOIN public."method" m ON m.id = t.method_id',
      );
      const cambios = rows
        .map((r) => ({ actual: Number(r.id), nuevo: deseado.get(nameKey(r.s, r.c, r.m)) }))
        .filter((x) => x.nuevo && x.nuevo !== x.actual);
      if (cambios.length === 0) return { movidas: 0 };

      // Transacciones que no están en el CSV pero ocupan un número que el CSV
      // necesita: se corren al final para no chocar.
      const objetivo = new Set([...deseado.values()]);
      const enCsv = new Set(rows.filter((r) => deseado.has(nameKey(r.s, r.c, r.m))).map((r) => Number(r.id)));
      const estorbos = rows.map((r) => Number(r.id)).filter((id) => !enCsv.has(id) && objetivo.has(id));
      let libre = Math.max(0, ...rows.map((r) => Number(r.id)), ...objetivo) + 1;

      await client.query('BEGIN');
      // Dos pasos (primero a negativo) para no violar la clave primaria a mitad del cambio.
      for (const id of estorbos) await client.query('UPDATE public."transaction" SET id = $1 WHERE id = $2', [-(libre++), id]);
      for (const x of cambios) await client.query('UPDATE public."transaction" SET id = $1 WHERE id = $2', [-x.nuevo, x.actual]);
      await client.query('UPDATE public."transaction" SET id = -id WHERE id < 0');
      await client.query(`SELECT setval(pg_get_serial_sequence('public."transaction"', 'id'), (SELECT MAX(id) FROM public."transaction"))`);
      await client.query('COMMIT');
      console.log(`[Security] Numeración de transacciones alineada con permission.csv: ${cambios.length} movida(s)`);
      return { movidas: cambios.length };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[Security] No se pudo alinear la numeración de transacciones (se deja como estaba):', error?.message || error);
      return { movidas: 0, error: error?.message };
    } finally {
      client.release();
    }
  }

  async getPermissionsFile() {
    // Si existe la variable de entorno, úsala. Si no, usa el path predeterminado.
    const defaultPath = path.resolve(__dirname, '../../config/permission.csv');
    const csvPath = process.env.PERMISSIONS_FILE_PATH 
      ? path.resolve(process.env.PERMISSIONS_FILE_PATH) 
      : defaultPath;

    const csvMap = await this.utils.readCSV(csvPath);
    const permissions = new Map();

    for (const row of csvMap.values()) {
      const normalized = this.normalizePermission(row);
      const key = this.buildPermissionKey(normalized);
      permissions.set(key, normalized);
    }

    return permissions;
  }

  async getPermissionsDB() {
    await this.dbmsReady;
    const res = await this.dbms.executeNamedQuery({
      nameQuery: 'getPermissions',
    });

    const permissions = new Map();
    for (const row of res?.rows ?? []) {
      const normalized = this.normalizePermission(row);
      const key = this.buildPermissionKey(normalized);
      permissions.set(key, normalized);
    }

    return permissions;
  }

  hasPermission(permission) {
    const key = this.buildPermissionKey(permission);
    return this.permissions.has(key);
  }

  isUserAuthorized(userId, transactionId) {
    const tx = this.resolveTransaction(transactionId);
    if (!tx) return false;

    const normalizedUserId = String(userId).trim().toLowerCase();
    const profiles = this.userProfiles.get(normalizedUserId);
    if (!profiles) return false;

    for (const profile of profiles) {
      const checkPerm = {
        sub_system: tx.sub_system,
        class: tx.class,
        method: tx.method,
        profile: profile
      };
      
      if (this.hasPermission(checkPerm)) {
        return true;
      }
    }
    
    return false;
  }

  async setPermission(permission) {
    await this.dbmsReady;
    const client = await this.dbms.beginTransaction();
    try {
      await this.dbms.executeNamedQuery({
        nameQuery: 'ensureTransactionSerial',
        client
      });

      const normalized = this.normalizePermission(permission);

      await this.dbms.executeNamedQuery({
        nameQuery: 'insertPermission',
        params: {
          sub_system: normalized.sub_system,
          class_name: normalized.class,
          method_name: normalized.method,
          profile_name: normalized.profile,
        },
        client
      });

      await this.dbms.commitTransaction(client);
      this.permissions.set(this.buildPermissionKey(normalized), normalized);
    } catch (error) {
      await this.dbms.rollbackTransaction(client);
      throw error;
    } finally {
      this.dbms.endTransaction(client);
    }
  }

  async syncUserProfiles() {
    await this.dbmsReady;
    const res = await this.dbms.executeNamedQuery({
      nameQuery: 'getUsersProfiles',
    });

    const profiles = new Map();
    for (const row of res?.rows ?? []) {
      const userId = String(row.user_id || row.username)
        .trim()
        .toLowerCase();
      const profileName = String(row.profile_name || row.profile)
        .trim()
        .toLowerCase();

      if (!profiles.has(userId)) {
        profiles.set(userId, new Set());
      }
      profiles.get(userId).add(profileName);
    }

    this.userProfiles = profiles;
    return this.userProfiles;
  }

  hasUserProfile(userId, profile) {
    const normalizedUserId = String(userId).trim().toLowerCase();
    const normalizedProfile = String(profile).trim().toLowerCase();

    const userProfiles = this.userProfiles.get(normalizedUserId);
    return userProfiles ? userProfiles.has(normalizedProfile) : false;
  }

  async setUserProfile(userId, profile) {
    await this.dbmsReady;
    const client = await this.dbms.beginTransaction();
    try {
      await this.dbms.executeNamedQuery({
        nameQuery: 'ensureTransactionSerial',
        client
      });

      const normalizedUserId = String(userId).trim().toLowerCase();
      const normalizedProfile = String(profile).trim().toLowerCase();

      await this.dbms.executeNamedQuery({
        nameQuery: 'insertUserProfile',
        params: {
          user_id: userId,
          profile_name: profile,
        },
        client
      });

      await this.dbms.commitTransaction(client);

      if (!this.userProfiles.has(normalizedUserId)) {
        this.userProfiles.set(normalizedUserId, new Set());
      }
      this.userProfiles.get(normalizedUserId).add(normalizedProfile);
    } catch (error) {
      await this.dbms.rollbackTransaction(client);
      throw error;
    } finally {
      this.dbms.endTransaction(client);
    }
  }

  async syncTransactions() {
    await this.dbmsReady;

    // Supongamos que esta query trae: id, sub_system, class_name, method_name
    const res = await this.dbms.executeNamedQuery({ nameQuery: 'getTransactions' });

    this.transactions.clear();

    for (const row of res?.rows ?? []) {
      this.transactions.set(String(row.id), {
        sub_system: row.sub_system,
        class: row.class_name,
        method: row.method_name
      });
    }

    return this.transactions;
  }

  resolveTransaction(transactionId) {
    return this.transactions.get(String(transactionId));
  }

  async execute(transactionId, reqBody = {}) {
    try {
      const tx = this.resolveTransaction(transactionId);
      if (!tx) {
        return this.utils.handleError({
          message: 'Transacción no encontrada o inválida',
          statusCode: 404
        });
      }

      const { sub_system, class: className, method } = tx;

      const actionInstance = await resolveExecutable({
        subsystem: sub_system,
        className: className,
        method: method
      });

      const result = await Reflect.apply(
          actionInstance[method],
          actionInstance,
          [reqBody]
      );

      return {
        statusCode: 200,
        data: result,
        message: 'Ejecutado exitosamente'
      };

    } catch (error) {
      console.error(`Error en execute:`, error);
      return this.utils.handleError({
        message: 'Error interno al ejecutar la transacción',
        statusCode: 500
      });
    }
  }
}
