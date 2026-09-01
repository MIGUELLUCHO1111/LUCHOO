import { createContext, useContext, useState, useEffect } from "react";
import { authService, optionService } from "@/services";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => authService.getUser());
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Rutas que el perfil del usuario logueado puede usar (según Security/Option).
  // null = todavía no se resolvió; se trata como "sin restricción" para no
  // bloquear el menú/rutas mientras carga.
  const [allowedSections, setAllowedSections] = useState(null);

  const loadAllowedSections = async (userData) => {
    const profileId = userData?.profiles?.[0]?.id;
    if (!profileId) {
      setAllowedSections([]);
      return;
    }
    try {
      const opts = await optionService.getByProfile(profileId);
      const routes = (Array.isArray(opts) ? opts : []).map((o) => o.name);
      setAllowedSections(routes);
    } catch {
      setAllowedSections([]);
    }
  };

  const checkAuth = async () => {
    try {
      const userData = await authService.getMe();
      if (userData) {
        setUser(userData);
        await loadAllowedSections(userData);
      } else {
        setUser(null);
        setAllowedSections([]);
      }
    } catch {
      setUser(null);
      setAllowedSections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const publicRoutes = ["/login", "/forgot-password", "/reset-password"];
    const isPublicRoute = publicRoutes.includes(window.location.pathname);

    if (!isPublicRoute) {
      checkAuth();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (credentials) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const data = await authService.login(
        credentials.username,
        credentials.password
      );
      if (data.user) {
        setUser(data.user);
        await loadAllowedSections(data.user);
        return data;
      }
    } catch (err) {
      const message =
        err.response?.data?.message || "Error en la autenticación";
      setAuthError(message);
      throw new Error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = async (navigate) => {
    try {
      await authService.logout();
      setUser(null);
      setAllowedSections(null);
      if (navigate) {
        navigate("/login", { replace: true });
      }
    } catch (error) {
      console.error("Error al cerrar sesión", error);
    }
  };

  const forgotPassword = async ({ email }) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const data = await authService.forgotPassword(email);
      return data;
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Error al enviar el correo de recuperación";
      setAuthError(message);
      throw new Error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetPassword = async ({ token, password, confirmPassword }) => {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const data = await authService.resetPassword(
        token,
        password,
        confirmPassword
      );
      return data;
    } catch (err) {
      const message =
        err.response?.data?.message || "Error al restablecer la contraseña";
      setAuthError(message);
      throw new Error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        allowedSections,
        isSubmitting,
        authError,
        login,
        logout,
        forgotPassword,
        resetPassword,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
};
