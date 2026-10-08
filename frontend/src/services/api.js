import { API_BASE_URL } from "./apiBase";
import axios from "axios";

const api = axios.create({
  baseURL: API_BASE_URL,
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

// Cierre por inactividad (08/10/2026): el servidor renueva el pase en la
// cabecera X-Auth-Token; aquí se guarda, y se anota cuándo fue el último
// contacto con el servidor (lo usa IdleSessionGuard para decidir si renovar
// en segundo plano mientras la persona sigue activa sin pedir nada).
export const SESSION_END_REASON_KEY = "session_end_reason";
let lastServerContact = Date.now();
export const getLastServerContact = () => lastServerContact;

// Interceptor: maneja errores globales
api.interceptors.response.use(
  (res) => {
    const refreshed = res.headers?.["x-auth-token"];
    if (refreshed && localStorage.getItem("token")) localStorage.setItem("token", refreshed);
    lastServerContact = Date.now();
    return res;
  },
  (err) => {
    const status = err.response?.status;
    const isPublicRoute = PUBLIC_ROUTES.includes(window.location.pathname);

    // Sesión vencida o inválida (cookie o token) → mandar al login en vez de
    // dejar la pantalla mostrando datos vacíos sin explicación. No aplica en
    // rutas públicas: ahí un 401 es un intento de login fallido normal, que
    // ya maneja su propio formulario.
    if (status === 401 && !isPublicRoute) {
      localStorage.removeItem("token");
      // La pantalla de login explica por qué se cerró (si no lo cerró ya el
      // contador de inactividad con su propio motivo).
      if (!sessionStorage.getItem(SESSION_END_REASON_KEY)) {
        sessionStorage.setItem(SESSION_END_REASON_KEY, "expired");
      }
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
