-- ============================================================
-- 019_tracker_report_file_formats.sql
-- Cada reporte de turno generado ahora existe en tres formatos de
-- descarga (Excel, PDF, imagen) en vez de solo Excel. Se renombran las
-- columnas existentes a *_xlsx para dejar el patrón explícito y se agregan
-- las columnas equivalentes para PDF y PNG. mime_type se elimina porque ya
-- no aplica a un solo archivo por fila -- cada formato tiene un mime fijo
-- y conocido, resuelto en el backend al servir el archivo.
-- ============================================================

BEGIN;

ALTER TABLE public.tracker_report_file RENAME COLUMN filename TO filename_xlsx;
ALTER TABLE public.tracker_report_file RENAME COLUMN url TO url_xlsx;
ALTER TABLE public.tracker_report_file RENAME COLUMN size_bytes TO size_bytes_xlsx;
ALTER TABLE public.tracker_report_file DROP COLUMN IF EXISTS mime_type;

ALTER TABLE public.tracker_report_file
  ADD COLUMN IF NOT EXISTS filename_pdf VARCHAR(255),
  ADD COLUMN IF NOT EXISTS url_pdf VARCHAR(300),
  ADD COLUMN IF NOT EXISTS size_bytes_pdf INTEGER,
  ADD COLUMN IF NOT EXISTS filename_png VARCHAR(255),
  ADD COLUMN IF NOT EXISTS url_png VARCHAR(300),
  ADD COLUMN IF NOT EXISTS size_bytes_png INTEGER;

COMMIT;
