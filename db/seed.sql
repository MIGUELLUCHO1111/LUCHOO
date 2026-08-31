-- ============================================================
-- seed.sql - Datos iniciales de seguridad (Fullpetro)
-- Usuario admin por defecto: admin01 / Admin1234
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
    '$2b$10$ER9esvHSoEMWCc60ZEiviugwBDvABLweXcqTd3bx5/fwaO.77uFFu',
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