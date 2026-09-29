import { auth } from "@/lib/auth/index";
import { headers } from "next/headers";
import { db } from "@/lib/db/client";
import { usuario } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getSession() {
    return auth.api.getSession({
        headers: await headers(),
    })
}

export async function getUserRole(){
    const session = await getSession()
    if(!session) return null

    const user = await db
        .select({ rol: usuario.rol })
        .from(usuario)
        .where(eq(usuario.id, session.user.id))
        .limit(1)

    return user[0]?.rol ?? null
}

export async function requiereAuth(){
    const session = await getSession()
    if(!session) throw new Error("No autenticado")
    return session
}

export async function requeireRole(
    rol: "paciente" | "médico" | "secretario" | "admin"
){
    const session = await requiereAuth()
    const userRol = await getUserRole()
    if(userRol !== rol) throw new Error("No autorizado")
    return session
}