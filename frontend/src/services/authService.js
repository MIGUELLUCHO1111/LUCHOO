import api from "./api";

const TOKEN_KEY = "token";
const USER_KEY = "user";

const authService = {
  /**
   * Login: guarda token y usuario en localStorage.
   * @returns {{ user, token }}
   */
  async login(username, password) {
    const { data } = await api.post("/user/login", { username, password });

    if (data.token) {
      localStorage.setItem(TOKEN_KEY, data.token);
    }
    if (data.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
    // Minutos sin actividad antes de cerrar la sesión (los define el servidor).
    if (data.session_idle_minutes) {
      localStorage.setItem("session_idle_minutes", String(data.session_idle_minutes));
    }

    return data;
  },

  /**
   * Logout: limpia estado local y destruye sesión server-side.
   */
  async logout(reason) {
    try {
      // reason "idle": cierre por inactividad (queda así en la auditoría).
      await api.post("/user/logout", reason ? { reason } : {});
    } catch (_) {
      // silently ignore — la sesión puede haber expirado
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  /**
   * Obtiene el usuario actual (soporta Bearer y cookie).
   * @returns {object|null} usuario o null
   */
  async getMe() {
    try {
      const { data } = await api.get("/user/me");
      localStorage.setItem(USER_KEY, JSON.stringify(data));
      if (data?.session_idle_minutes) {
        localStorage.setItem("session_idle_minutes", String(data.session_idle_minutes));
      }
      return data;
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return null;
    }
  },

  getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  isAuthenticated() {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  },

};

export default authService;
