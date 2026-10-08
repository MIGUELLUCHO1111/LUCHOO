import SS from '../session/sessionWrapper.js';
import Config from '../../config/config.js';
import Security from '../security/security.js';
import { recordAction } from '../security/activityTracker.js';
import { isReadMethod } from '../bo/sub_system/classes/option.js';

// Transacciones de "autoservicio": cualquier usuario autenticado puede
// ejecutarlas para SU perfil, sin necesitar un method_profile explícito.
// Sin esto, ningún perfil nuevo podría nunca averiguar qué secciones puede
// ver (consultar tu propio menú no debería requerir ya tener un permiso).
const SELF_SERVICE_METHODS = new Set(['Security.Option.getOptionsByProfile']);

export default class Dispatcher {
  static instance;

  constructor() {
    if (Dispatcher.instance) return Dispatcher.instance;

    this.config = new Config();
    this.session = new SS();
    this.security = new Security();
    Dispatcher.instance = this;
  }

  async toProccess(request) {
    try {
      const body = request?.body || {};
      const lang = body.lang || 'es';
      const txId = body.transaction_id;
      const parameters = body.data || {};
      const profile = body.profile;

      if (!request.user) {
        return {
          statusCode: this.config.STATUS_CODES.UNAUTHORIZED,
          message: this.config.getMessage(lang, 'session_required'),
        };
      }

      // 400/403 reales (08/10/2026): antes estos casos respondían 200 con un
      // texto suelto, y la pantalla podía tomarlo como éxito.
      if (!txId) {
        return { statusCode: 400, message: this.config.getMessage(lang, 'missing_transaction_id') };
      }
      if (!profile) {
        return { statusCode: 400, message: 'Perfil no especificado en la petición' };
      }

      const userId = request.user.id;
      // También cae aquí un usuario eliminado o desactivado con la sesión aún
      // abierta: ya no figura en el mapa de perfiles (getUsersProfiles).
      if (!this.security.hasUserProfile(userId, profile)) {
        return { statusCode: 403, message: 'Tu usuario no tiene ese perfil asignado o fue desactivado.' };
      }

      const permissionRoute = this.security.resolveTransaction(txId);
      if (!permissionRoute) {
        return { statusCode: 404, message: `Transacción no encontrada: ${txId}` };
      }

      const permission = {
        ...permissionRoute,
        profile: profile
      };

      const routeKey = `${permissionRoute.sub_system}.${permissionRoute.class}.${permissionRoute.method}`;
      const isSelfService = SELF_SERVICE_METHODS.has(routeKey);

      if (!isSelfService && !this.security.hasPermission(permission)) {
        // Antes devolvía 200 con el texto "missing_required_fields": la pantalla
        // lo tomaba como éxito y parecía que se había guardado. Ahora es un 403
        // real con un mensaje claro (importa sobre todo con las secciones en
        // "solo ver", 065: ahí cualquier intento de guardar llega aquí).
        return {
          statusCode: this.config.STATUS_CODES?.FORBIDDEN || 403,
          message: 'No tienes permiso para esta acción. Si tu acceso a esta sección es de solo lectura, pide a un administrador que te lo amplíe.',
        };
      }

      // `profile` ya fue verificado arriba contra el usuario autenticado real
      // (hasUserProfile) y contra el permiso del método (hasPermission) -- es
      // confiable pasarlo tal cual al método de negocio. Se usa hoy solo para
      // el acceso por proyecto de Control de Horas (ver `project_profile_assignment`
      // y `assertProjectAccess` en `classes/projectAccess.js`); cualquier otro
      // método existente simplemente lo ignora al desestructurar sus propios
      // parámetros con nombre.
      // caller_user: nombre del usuario autenticado, para dejar quien hizo
      // cada cambio en el historial de la Ficha de Vehiculos (fleet_unit_event).
      const callerUser = request.user.username || request.user.name || null;
      // caller_user_id: para que Flota valide que un encargado solo toque SUS unidades.
      // Actividad de usuarios (066): una acción más en este módulo; cuenta
      // como escritura si no es una función de consulta.
      recordAction(userId, permissionRoute.sub_system, !isReadMethod(permissionRoute.method));
      return await this.security.execute(txId, { ...parameters, caller_profile: profile, caller_user: callerUser, caller_user_id: userId });

    } catch (error) {
      console.error(error);

      // Errores estructurados de negocio (utils.handleError lanza JSON.stringify(payload))
      try {
        const payload = JSON.parse(error.message);
        if (payload && payload.statusCode) {
          return {
            statusCode: payload.statusCode,
            message: payload.message || this.config.getMessage(request?.body?.lang || 'es', 'server_error'),
            error: payload.error ?? undefined,
          };
        }
      } catch (_) {
        /* no era un payload estructurado */
      }

      return {
        statusCode: this.config.STATUS_CODES?.INTERNAL_SERVER_ERROR || 500,
        message: this.config.getMessage(request?.body?.lang || 'es', 'server_error'),
      };
    }
  }
}