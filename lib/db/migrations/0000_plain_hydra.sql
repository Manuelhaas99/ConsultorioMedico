CREATE TYPE "public"."dia_semana" AS ENUM('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo');--> statement-breakpoint
CREATE TYPE "public"."estado_cita" AS ENUM('pendiente', 'confirmada', 'cancelada', 'completada', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('paciente', 'medico', 'secretario', 'admin');--> statement-breakpoint
CREATE TABLE "bloqueo_horario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"fecha_inicio" timestamp NOT NULL,
	"fecha_fin" timestamp NOT NULL,
	"motivo" text,
	"creado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cita" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"paciente_id" uuid,
	"ubicacion_id" uuid,
	"tipo_consulta_id" uuid,
	"invitado_nombre" text,
	"invitado_email" text,
	"invitado_telefono" text,
	"fecha_inicio" timestamp NOT NULL,
	"fecha_fin" timestamp NOT NULL,
	"estado" "estado_cita" DEFAULT 'pendiente' NOT NULL,
	"motivo_consulta" text,
	"notas" text,
	"google_calendar_event_id" text,
	"token_gestion" text,
	"recordatorio_24h_enviado" boolean DEFAULT false NOT NULL,
	"recordatorio_1h_enviado" boolean DEFAULT false NOT NULL,
	"asistio" boolean,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	"actualizado_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cita_token_gestion_unique" UNIQUE("token_gestion")
);
--> statement-breakpoint
CREATE TABLE "disponibilidad_doctor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"ubicacion_id" uuid,
	"dia_semana" "dia_semana" NOT NULL,
	"hora_inicio" time NOT NULL,
	"hora_fin" time NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"especialidad_id" uuid NOT NULL,
	"cedula" text NOT NULL,
	"bio" text,
	"aprobado" boolean DEFAULT false NOT NULL,
	"google_calendar_id" text,
	"google_refresh_token" text,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "doctor_cedula_unique" UNIQUE("cedula")
);
--> statement-breakpoint
CREATE TABLE "especialidad" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"icono" text,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "especialidad_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "secretario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"creado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tipo_consulta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doctor_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"duracion_minutos" integer DEFAULT 30 NOT NULL,
	"creado_en" timestamp DEFAULT now() NOT NULL
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
	"creado_en" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"email_verificado" boolean DEFAULT false NOT NULL,
	"telefono" text,
	"telefono_verificado" boolean DEFAULT false NOT NULL,
	"avatar_url" text,
	"rol" "rol" DEFAULT 'paciente' NOT NULL,
	"creado_en" timestamp DEFAULT now() NOT NULL,
	"actualizado_en" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_email_unique" UNIQUE("email")
);
--> statement-breakpoint
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
ALTER TABLE "tipo_consulta" ADD CONSTRAINT "tipo_consulta_doctor_id_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ubicacion" ADD CONSTRAINT "ubicacion_doctor_id_doctor_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctor"("id") ON DELETE cascade ON UPDATE no action;