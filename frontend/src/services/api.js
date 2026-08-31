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

// Interceptor: maneja errores globales
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;

    // Token expirado o inválido → limpiar y redirigir
    if (status === 401 && localStorage.getItem("token")) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }

    return Promise.reject(err);
  }
);

/**
 * Ejecuta una transacción vía el dispatcher.
 * @param {number} transactionId - ID de la transacción (permission.csv)
 * @param {object} data - Payload de la transacción
 * @param {string} profile - Perfil del usuario (default 'admin')
 */
export const executeTransaction = (transactionId, data = {}, profile = "admin") => {
  return api.post("/", { transaction_id: transactionId, data, profile });
};

export default api;
