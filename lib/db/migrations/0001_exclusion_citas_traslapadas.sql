-- C4: garantiza en la base que un doctor no tenga dos citas activas traslapadas.
-- Intervalos semiabiertos [inicio, fin): 09:00-09:30 y 09:30-10:00 no chocan.
-- Los estados excluidos del WHERE deben coincidir con ESTADOS_QUE_LIBERAN_HORARIO
-- (lib/citas/intervalos.ts); lib/citas/exclusion.test.ts lo verifica.
-- Las columnas aún son timestamp sin zona, por eso tsrange; cuando migren a
-- timestamptz (C6) esta restricción debe recrearse con tstzrange.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "cita" ADD CONSTRAINT "cita_sin_traslape_por_doctor" EXCLUDE USING gist (
	"doctor_id" WITH =,
	tsrange("fecha_inicio", "fecha_fin", '[)') WITH &&
) WHERE ("estado" NOT IN ('cancelada'));
