import SS from '../session/sessionWrapper.js';
import Config from '../../config/config.js';
import Security from '../security/security.js';

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

      if (!txId) {
        return this.config.getMessage(lang, 'missing_transaction_id');
      }
      if (!profile) {
        return { statusCode: 400, message: 'Perfil no especificado en la petición' };
      }

      const userId = request.user.id;
      if (!this.security.hasUserProfile(userId, profile)) {
        return this.config.getMessage(lang, 'profile_not_assigned');
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
        return this.config.getMessage(lang, 'missing_required_fields'); // O 'unauthorized_action'
      }

      return await this.security.execute(txId, parameters);

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