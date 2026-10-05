-- La app siempre escribió instantes en UTC (Drizzle serializa Date con toISOString),
-- así que los valores existentes se interpretan como UTC en lugar de depender del
-- TimeZone de la sesión que corre la migración.
-- La restricción de exclusión usa tsrange y bloquea el cambio de tipo: se elimina y
-- se recrea con tstzrange.
-- fecha_inicio y fecha_fin cambian en la misma sentencia: por separado, el CHECK
-- fecha_fin > fecha_inicio compararía timestamptz con timestamp y fallaría en
-- sesiones al este de UTC.
ALTER TABLE "cita" DROP CONSTRAINT "cita_sin_traslape_por_doctor";--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "access_token_expires_at" SET DATA TYPE timestamp with time zone USING "access_token_expires_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "refresh_token_expires_at" SET DATA TYPE timestamp with time zone USING "refresh_token_expires_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "bloqueo_horario"
	ALTER COLUMN "fecha_inicio" SET DATA TYPE timestamp with time zone USING "fecha_inicio" AT TIME ZONE 'UTC',
	ALTER COLUMN "fecha_fin" SET DATA TYPE timestamp with time zone USING "fecha_fin" AT TIME ZONE 'UTC',
	ALTER COLUMN "creado_en" SET DATA TYPE timestamp with time zone USING "creado_en" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "cita"
	ALTER COLUMN "fecha_inicio" SET DATA TYPE timestamp with time zone USING "fecha_inicio" AT TIME ZONE 'UTC',
	ALTER COLUMN "fecha_fin" SET DATA TYPE timestamp with time zone USING "fecha_fin" AT TIME ZONE 'UTC',
	ALTER COLUMN "creado_en" SET DATA TYPE timestamp with time zone USING "creado_en" AT TIME ZONE 'UTC',
	ALTER COLUMN "actualizado_en" SET DATA TYPE timestamp with time zone USING "actualizado_en" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "doctor" ALTER COLUMN "creado_en" SET DATA TYPE timestamp with time zone USING "creado_en" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "especialidad" ALTER COLUMN "creado_en" SET DATA TYPE timestamp with time zone USING "creado_en" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "secretario" ALTER COLUMN "creado_en" SET DATA TYPE timestamp with time zone USING "creado_en" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone USING "expires_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "tipo_consulta" ALTER COLUMN "creado_en" SET DATA TYPE timestamp with time zone USING "creado_en" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "ubicacion" ALTER COLUMN "creado_en" SET DATA TYPE timestamp with time zone USING "creado_en" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "usuario" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "usuario" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "expires_at" SET DATA TYPE timestamp with time zone USING "expires_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "cita" ADD CONSTRAINT "cita_sin_traslape_por_doctor" EXCLUDE USING gist (
	"doctor_id" WITH =,
	tstzrange("fecha_inicio", "fecha_fin", '[)') WITH &&
) WHERE ("estado" NOT IN ('cancelada'));
