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

    return data;
  },

  /**
   * Logout: limpia estado local y destruye sesión server-side.
   */
  async logout() {
    try {
      await api.post("/user/logout");
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

  async forgotPassword(email) {
    const { data } = await api.post("/user/forgot-password", { email });
    return data;
  },

  async resetPassword(token, password, confirmPassword) {
    const { data } = await api.post("/user/reset-password", {
      token,
      password,
      confirmPassword,
    });
    return data;
  },
};

export default authService;
