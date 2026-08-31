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

  async getPermissionsFile() {
    const csvPath = path.resolve(__dirname, '../../config/permission.csv');
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

  async setPermission(permission) {
    await this.dbmsReady;
    await this.dbms.executeNamedQuery({
      nameQuery: 'ensureTransactionSerial',
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
    });

    this.permissions.set(this.buildPermissionKey(normalized), normalized);
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
    await this.dbms.executeNamedQuery({
      nameQuery: 'ensureTransactionSerial',
    });

    const normalizedUserId = String(userId).trim().toLowerCase();
    const normalizedProfile = String(profile).trim().toLowerCase();

    await this.dbms.executeNamedQuery({
      nameQuery: 'insertUserProfile',
      params: {
        user_id: userId,
        profile_name: profile,
      },
    });

    if (!this.userProfiles.has(normalizedUserId)) {
      this.userProfiles.set(normalizedUserId, new Set());
    }
    this.userProfiles.get(normalizedUserId).add(normalizedProfile);
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

  async execute(permission, reqBody = {}) {
    try {
      const { sub_system, class: className, method } = this.normalizePermission(permission);

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
      console.error(`Error en executeAuthorized:`, error);
      throw error;
    }
  }
}
