import { useState, useEffect } from "react";
import { useNavigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context";
import { AlertMessage } from "@/components";

export const ProtectedRoute = () => {
  const { user, loading } = useAuth();
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
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="text-blue-500 font-medium animate-pulse">
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }


  return <Outlet />;
};