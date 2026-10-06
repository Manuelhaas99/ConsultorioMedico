CREATE INDEX "bloqueo_horario_doctor_id_idx" ON "bloqueo_horario" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "cita_doctor_id_fecha_inicio_idx" ON "cita" USING btree ("doctor_id","fecha_inicio");--> statement-breakpoint
CREATE INDEX "cita_paciente_id_idx" ON "cita" USING btree ("paciente_id");--> statement-breakpoint
CREATE INDEX "disponibilidad_doctor_doctor_id_idx" ON "disponibilidad_doctor" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "doctor_usuario_id_idx" ON "doctor" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "secretario_doctor_id_idx" ON "secretario" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "tipo_consulta_doctor_id_idx" ON "tipo_consulta" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "ubicacion_doctor_id_idx" ON "ubicacion" USING btree ("doctor_id");--> statement-breakpoint
ALTER TABLE "bloqueo_horario" ADD CONSTRAINT "bloqueo_horario_fechas_validas" CHECK ("bloqueo_horario"."fecha_fin" > "bloqueo_horario"."fecha_inicio");--> statement-breakpoint
ALTER TABLE "cita" ADD CONSTRAINT "cita_fechas_validas" CHECK ("cita"."fecha_fin" > "cita"."fecha_inicio");--> statement-breakpoint
ALTER TABLE "cita" ADD CONSTRAINT "cita_paciente_o_invitado" CHECK ("cita"."paciente_id" IS NOT NULL OR (coalesce("cita"."invitado_nombre", '') <> '' AND coalesce("cita"."invitado_email", '') <> ''));--> statement-breakpoint
ALTER TABLE "disponibilidad_doctor" ADD CONSTRAINT "disponibilidad_doctor_horas_validas" CHECK ("disponibilidad_doctor"."hora_fin" > "disponibilidad_doctor"."hora_inicio");--> statement-breakpoint
ALTER TABLE "tipo_consulta" ADD CONSTRAINT "tipo_consulta_duracion_positiva" CHECK ("tipo_consulta"."duracion_minutos" > 0);