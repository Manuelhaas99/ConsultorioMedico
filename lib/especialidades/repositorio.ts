import "server-only"
import { db } from "@/lib/db/client"
import { especialidad } from "@/lib/db/schema"

export type FilaEspecialidad = typeof especialidad.$inferSelect

export async function todasLasEspecialidades(): Promise<FilaEspecialidad[]> {
    return db.select().from(especialidad).orderBy(especialidad.nombre)
}
