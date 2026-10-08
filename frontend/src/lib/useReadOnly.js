import { useLocation } from "react-router-dom";
import { useAuth } from "@/context";

// Acceso de "solo ver" por sección (065, 08/10/2026). Devuelve true si el
// perfil del usuario tiene la sección de la pantalla actual en solo lectura:
// la pantalla esconde crear/editar/eliminar/guardar. Es solo para la vista --
// el backend ya rechaza cualquier escritura con 403, aunque alguien se salte
// esto.
//
// Las pantallas de detalle heredan la sección de su lista (/fleet/12 →
// /fleet), igual que DETAIL_ROUTES en ProtectedRoute.
const DETAIL_ROUTES = [[/^\/fleet\/\d+$/, "/fleet"]];

export function sectionForPath(pathname) {
  return DETAIL_ROUTES.find(([re]) => re.test(pathname))?.[1] || pathname;
}

export function useReadOnly(sectionPath) {
  const { readOnlySections } = useAuth();
  const location = useLocation();
  const section = sectionPath || sectionForPath(location.pathname);
  return Array.isArray(readOnlySections) && readOnlySections.includes(section);
}
