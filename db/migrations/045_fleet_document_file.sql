-- ============================================================
-- 045_fleet_document_file.sql
-- Documentos de la Ficha de Vehiculos con archivo adjunto (PDF o foto),
-- pedido de Lguerra 30/09/2026: cada documento (RCV, INTT, permiso,
-- izamiento...) se carga por separado y con su respaldo. El archivo se sube
-- por la ruta multipart /fleet/documents/file (fleetPhotoRoutes.js).
-- OJO al integrar con la rama de Julio (la principal, no se modifica): si
-- alli tambien existe una 043/044/045, se renumeran LAS NUESTRAS.
-- ============================================================

ALTER TABLE public.fleet_unit_document
  ADD COLUMN IF NOT EXISTS file_url VARCHAR(300),
  ADD COLUMN IF NOT EXISTS file_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS file_mime VARCHAR(80);
