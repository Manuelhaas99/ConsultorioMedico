-- Los tokens de invitados se convierten a su hash (igual al que calcula la app) para que
-- los enlaces ya enviados sigan funcionando; los de pacientes con cuenta se borran porque
-- gestionan sus citas con sesión.
ALTER TABLE "cita" RENAME COLUMN "token_gestion" TO "token_gestion_hash";--> statement-breakpoint
ALTER TABLE "cita" RENAME CONSTRAINT "cita_token_gestion_unique" TO "cita_token_gestion_hash_unique";--> statement-breakpoint
UPDATE "cita" SET "token_gestion_hash" = CASE
	WHEN "paciente_id" IS NOT NULL THEN NULL
	ELSE encode(sha256(convert_to("token_gestion_hash", 'UTF8')), 'hex')
END
WHERE "token_gestion_hash" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "cita" ADD CONSTRAINT "cita_token_gestion_hash_formato" CHECK ("cita"."token_gestion_hash" ~ '^[0-9a-f]{64}$');
