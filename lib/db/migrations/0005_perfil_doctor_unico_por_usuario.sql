-- Falla si algún usuario ya tiene más de un perfil; encuéntralos con
--   select usuario_id, count(*) from doctor group by usuario_id having count(*) > 1;
-- y elimina los sobrantes antes de aplicarla.
ALTER TABLE "doctor" ADD CONSTRAINT "doctor_usuario_id_unique" UNIQUE("usuario_id");--> statement-breakpoint
DROP INDEX "doctor_usuario_id_idx";
