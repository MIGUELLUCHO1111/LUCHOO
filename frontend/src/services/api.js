import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Interceptor: adjunta token Bearer si existe en localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const PUBLIC_ROUTES = ["/login", "/forgot-password", "/reset-password"];

// Interceptor: maneja errores globales
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const isPublicRoute = PUBLIC_ROUTES.includes(window.location.pathname);

    // Sesión vencida o inválida (cookie o token) → mandar al login en vez de
    // dejar la pantalla mostrando datos vacíos sin explicación. No aplica en
    // rutas públicas: ahí un 401 es un intento de login fallido normal, que
    // ya maneja su propio formulario.
    if (status === 401 && !isPublicRoute) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }

    return Promise.reject(err);
  }
);

/** Perfil primario del usuario logueado (guardado por authService en login/me). */
export const getCurrentProfile = () => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user?.profiles?.[0]?.name || null;
  } catch {
    return null;
  }
};

/**
 * Ejecuta una transacción vía el dispatcher.
 * @param {number} transactionId - ID de la transacción (permission.csv)
 * @param {object} data - Payload de la transacción
 * @param {string} [profile] - Perfil a reclamar; si se omite, usa el perfil
 *   primario del usuario logueado (antes iba fijo a "admin", lo que hacía
 *   que cualquier perfil que no fuera admin fallara en todo).
 */
export const executeTransaction = (transactionId, data = {}, profile) => {
  return api.post("/", { transaction_id: transactionId, data, profile: profile || getCurrentProfile() });
};

export default api;
