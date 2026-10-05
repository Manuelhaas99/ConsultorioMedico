-- Un usuario solo puede tener un perfil de doctor (A3). Si la base ya tiene
-- usuarios con más de un perfil, esta migración falla; encuéntralos con
--   select usuario_id, count(*) from doctor group by usuario_id having count(*) > 1;
-- y elimina los perfiles sobrantes antes de aplicarla.
-- El índice UNIQUE reemplaza al índice simple doctor_usuario_id_idx.
ALTER TABLE "doctor" ADD CONSTRAINT "doctor_usuario_id_unique" UNIQUE("usuario_id");--> statement-breakpoint
DROP INDEX "doctor_usuario_id_idx";
