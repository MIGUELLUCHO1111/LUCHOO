import { useState, useEffect } from "react";
import { useNavigate, Outlet, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/context";
import { AlertMessage } from "@/components";

export const ProtectedRoute = () => {
  const { user, loading, allowedSections } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let timer;
    if (!loading && !user && location.pathname !== "/login") {
      timer = setTimeout(() => {
        setShowWarning(true);
      }, 1500);
    }


    if (user) {
      setShowWarning(false);
    }


    return () => clearTimeout(timer);
  }, [loading, user, location.pathname]);


  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg-main)]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-navy"></div>
          <p className="text-brand-navy font-medium animate-pulse">
            Verificando sesión...
          </p>
        </div>
      </div>
    );
  }


  if (!user && showWarning) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg-main)] p-4">
        <AlertMessage
          title="Sesión Requerida"
          message="No tienes una sesión activa. Por favor, inicia sesión para acceder."
          buttonText="Ir al Login"
          onConfirm={() => navigate("/login")}
          type="warning"
        />
      </div>
    );
  }


  if (!user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[var(--bg-main)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-navy"></div>
      </div>
    );
  }

  // /dashboard nunca se restringe (no está en el menú, es el aterrizaje).
  // allowedSections === null mientras se resuelve el perfil: no bloquea
  // todavía, para no redirigir de más antes de tener la respuesta.
  const isRestricted =
    allowedSections &&
    location.pathname !== "/dashboard" &&
    !allowedSections.includes(location.pathname);

  if (isRestricted) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};