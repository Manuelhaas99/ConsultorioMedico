-- Las columnas aún son timestamp sin zona, por eso tsrange; al migrar a
-- timestamptz esta restricción debe recrearse con tstzrange.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "cita" ADD CONSTRAINT "cita_sin_traslape_por_doctor" EXCLUDE USING gist (
	"doctor_id" WITH =,
	tsrange("fecha_inicio", "fecha_fin", '[)') WITH &&
) WHERE ("estado" NOT IN ('cancelada'));
