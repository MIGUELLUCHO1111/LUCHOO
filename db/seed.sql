-- ============================================================
-- seed.sql - Datos iniciales de seguridad (Fullpetro)
-- Instalación desde cero (producción arranca con la base VACÍA, 08/10/2026):
-- deja UN SOLO usuario, "admin", con el perfil admin. Su contraseña la
-- definió Julio y aquí solo va su hash bcrypt, nunca el texto. Se puede
-- reemplazar al instalar con INITIAL_ADMIN_PASSWORD (scripts/migrate.mjs) o
-- después con scripts/set-admin-password.mjs. Cámbiala desde el panel si la
-- contraseña llega a compartirse.
-- El perfil "admin" se sincroniza con permission.csv al arrancar.
-- ============================================================

BEGIN;

INSERT INTO person (document_id, first_name, last_name, phone, address)
VALUES ('ADMIN-00001', 'Administrador', 'Sistema', '+584140000000', 'Fullpetro')
ON CONFLICT (document_id) DO NOTHING;

INSERT INTO "user" (name, email, password_hash, is_solvency, is_active, person_id)
VALUES (
    'admin',
    'admin@fullpetro.com',
    '$2b$10$D45hF3IaGTfigjcM.Un1iuGOhw2yVKlBHxyHrRyGTYm5gnJH0.dqO',
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
WHERE u.name = 'admin' AND p.name = 'admin'
ON CONFLICT DO NOTHING;

COMMIT;
