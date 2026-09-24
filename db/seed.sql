-- ============================================================
-- seed.sql - Datos iniciales de seguridad (Fullpetro)
-- Usuario admin por defecto: admin01 (contraseña rotada 22/09/2026 para el
-- primer deploy a producción -- la anterior había quedado en texto plano
-- en este archivo/documentación, expuesta a cualquiera con acceso al
-- repo). La contraseña real se entregó fuera del repo (chat), nunca en
-- texto plano aquí -- solo el hash bcrypt. Cámbiala desde el panel apenas
-- entres, igual que recomienda deploy/DEPLOYMENT.md.
-- El perfil 'admin' se sincroniza con permission.csv al arrancar.
-- ============================================================

BEGIN;

INSERT INTO person (document_id, first_name, last_name, phone, address)
VALUES ('ADMIN-00001', 'Administrador', 'Sistema', '+595981000000', 'Fullpetro')
ON CONFLICT (document_id) DO NOTHING;

INSERT INTO "user" (name, email, password_hash, is_solvency, is_active, person_id)
VALUES (
    'admin01',
    'admin01@fullpetro.com',
    '$2b$10$.tGIGHfZCVub8rPc4IjAROLg/CvViUM2BYL7E3I0tDI1H/NeUkcni',
    TRUE,
    TRUE,
    (SELECT id FROM person WHERE document_id = 'ADMIN-00001')
)
ON CONFLICT DO NOTHING;

INSERT INTO profile (name, description, is_active)
VALUES ('admin', 'Administrador del sistema', TRUE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO user_profile (user_id, profile_id)
SELECT u.id, p.id
FROM "user" u, profile p
WHERE u.name = 'admin01' AND p.name = 'admin'
ON CONFLICT DO NOTHING;

COMMIT;