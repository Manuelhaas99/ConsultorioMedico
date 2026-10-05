import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { usuario } from "@/lib/db/schema"
import type { Rol } from "./roles"

/** Rol actual del usuario en la base, o `null` si no existe. */
export async function rolDeUsuario(usuarioId: string): Promise<Rol | null> {
    const [fila] = await db.select({ rol: usuario.rol }).from(usuario).where(eq(usuario.id, usuarioId)).limit(1)
    return fila?.rol ?? null
}
