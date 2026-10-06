CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE TYPE "public"."dia_semana" AS ENUM('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo');--> statement-breakpoint
CREATE TYPE "public"."estado_cita" AS ENUM('pendiente', 'confirmada', 'cancelada', 'completada', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('paciente', 'medico', 'secretario', 'admin');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bloqueo_horario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"fecha_inicio" timestamp with time zone NOT NULL,
	"fecha_fin" timestamp with time zone NOT NULL,
	"motivo" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bloqueo_horario_fechas_validas" CHECK ("bloqueo_horario"."fecha_fin" > "bloqueo_horario"."fecha_inicio")
);
--> statement-breakpoint
CREATE TABLE "cita" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"paciente_id" text,
	"ubicacion_id" uuid,
	"tipo_consulta_id" uuid,
	"invitado_nombre" text,
	"invitado_email" text,
	"invitado_telefono" text,
	"fecha_inicio" timestamp with time zone NOT NULL,
	"fecha_fin" timestamp with time zone NOT NULL,
	"estado" "estado_cita" DEFAULT 'pendiente' NOT NULL,
	"motivo_consulta" text,
	"notas" text,
	"google_calendar_event_id" text,
	"token_gestion_hash" text,
	"recordatorio_24h_enviado" boolean DEFAULT false NOT NULL,
	"recordatorio_1h_enviado" boolean DEFAULT false NOT NULL,
	"asistio" boolean,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cita_token_gestion_hash_unique" UNIQUE("token_gestion_hash"),
	CONSTRAINT "cita_fechas_validas" CHECK ("cita"."fecha_fin" > "cita"."fecha_inicio"),
	CONSTRAINT "cita_token_gestion_hash_formato" CHECK ("cita"."token_gestion_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "cita_paciente_o_invitado" CHECK ("cita"."paciente_id" IS NOT NULL OR (coalesce("cita"."invitado_nombre", '') <> '' AND coalesce("cita"."invitado_email", '') <> ''))
);
--> statement-breakpoint
CREATE TABLE "disponibilidad_doctor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"ubicacion_id" uuid,
	"dia_semana" "dia_semana" NOT NULL,
	"hora_inicio" time NOT NULL,
	"hora_fin" time NOT NULL,
	CONSTRAINT "disponibilidad_doctor_horas_validas" CHECK ("disponibilidad_doctor"."hora_fin" > "disponibilidad_doctor"."hora_inicio")
);
--> statement-breakpoint
CREATE TABLE "doctor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" text NOT NULL,
	"especialidad_id" uuid NOT NULL,
	"cedula" text NOT NULL,
	"bio" text,
	"aprobado" boolean DEFAULT false NOT NULL,
	"google_calendar_id" text,
	"google_refresh_token" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "doctor_usuario_id_unique" UNIQUE("usuario_id"),
	CONSTRAINT "doctor_cedula_unique" UNIQUE("cedula")
);
--> statement-breakpoint
CREATE TABLE "especialidad" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"icono" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "especialidad_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "secretario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" text NOT NULL,
	"doctor_id" uuid NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tipo_consulta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"duracion_minutos" integer DEFAULT 30 NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tipo_consulta_duracion_positiva" CHECK ("tipo_consulta"."duracion_minutos" > 0)
);
--> statement-breakpoint
CREATE TABLE "ubicacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"direccion" text NOT NULL,
	"ciudad" text NOT NULL,
	"colonia" text,
	"url_mapa" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"telefono" text,
	"telefono_verificado" boolean DEFAULT false,
	"image" text,
	"rol" "rol" DEFAULT 'paciente' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_usuario_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bloqueo_horario" ADD CONSTRAINT "bloqueo_horario_doctor_id_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cita" ADD CONSTRAINT "cita_doctor_id_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cita" ADD CONSTRAINT "cita_paciente_id_usuario_id_fk" FOREIGN KEY ("paciente_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cita" ADD CONSTRAINT "cita_ubicacion_id_ubicacion_id_fk" FOREIGN KEY ("ubicacion_id") REFERENCES "public"."ubicacion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cita" ADD CONSTRAINT "cita_tipo_consulta_id_tipo_consulta_id_fk" FOREIGN KEY ("tipo_consulta_id") REFERENCES "public"."tipo_consulta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disponibilidad_doctor" ADD CONSTRAINT "disponibilidad_doctor_doctor_id_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disponibilidad_doctor" ADD CONSTRAINT "disponibilidad_doctor_ubicacion_id_ubicacion_id_fk" FOREIGN KEY ("ubicacion_id") REFERENCES "public"."ubicacion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor" ADD CONSTRAINT "doctor_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor" ADD CONSTRAINT "doctor_especialidad_id_especialidad_id_fk" FOREIGN KEY ("especialidad_id") REFERENCES "public"."especialidad"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secretario" ADD CONSTRAINT "secretario_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secretario" ADD CONSTRAINT "secretario_doctor_id_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_usuario_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipo_consulta" ADD CONSTRAINT "tipo_consulta_doctor_id_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ubicacion" ADD CONSTRAINT "ubicacion_doctor_id_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bloqueo_horario_doctor_id_idx" ON "bloqueo_horario" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "cita_doctor_id_fecha_inicio_idx" ON "cita" USING btree ("doctor_id","fecha_inicio");--> statement-breakpoint
CREATE INDEX "cita_paciente_id_idx" ON "cita" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "disponibilidad_doctor_doctor_id_idx" ON "disponibilidad_doctor" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "secretario_doctor_id_idx" ON "secretario" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "tipo_consulta_doctor_id_idx" ON "tipo_consulta" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "ubicacion_doctor_id_idx" ON "ubicacion" USING btree ("doctor_id");--> statement-breakpoint
-- Drizzle no modela restricciones de exclusión: evita que un doctor tenga dos citas activas traslapadas.
ALTER TABLE "cita" ADD CONSTRAINT "cita_sin_traslape_por_doctor" EXCLUDE USING gist (
	"doctor_id" WITH =,
	tstzrange("fecha_inicio", "fecha_fin", '[)') WITH &&
) WHERE ("estado" NOT IN ('cancelada'));
