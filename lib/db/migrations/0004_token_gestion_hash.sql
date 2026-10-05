-- A2: la base guarda solo el SHA-256 (hex) del token de gestión, nunca el token.
-- Los tokens existentes se conservan como hash para que los enlaces ya enviados
-- a invitados sigan funcionando: sha256(convert_to(token, 'UTF8')) en hex es lo
-- mismo que calcula lib/citas/token.ts (sha256() es nativo desde Postgres 11,
-- no requiere pgcrypto).
-- Los pacientes con cuenta gestionan sus citas con sesión, así que sus tokens se borran.
ALTER TABLE "cita" RENAME COLUMN "token_gestion" TO "token_gestion_hash";--> statement-breakpoint
ALTER TABLE "cita" RENAME CONSTRAINT "cita_token_gestion_unique" TO "cita_token_gestion_hash_unique";--> statement-breakpoint
UPDATE "cita" SET "token_gestion_hash" = CASE
	WHEN "paciente_id" IS NOT NULL THEN NULL
	ELSE encode(sha256(convert_to("token_gestion_hash", 'UTF8')), 'hex')
END
WHERE "token_gestion_hash" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "cita" ADD CONSTRAINT "cita_token_gestion_hash_formato" CHECK ("cita"."token_gestion_hash" ~ '^[0-9a-f]{64}$');
