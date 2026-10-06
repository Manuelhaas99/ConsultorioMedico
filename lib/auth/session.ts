import "server-only"
import { headers } from "next/headers"
import { getAuth } from "@/lib/auth/index"
import { rolDeUsuario } from "./repositorio"
import { tieneRol, type Rol } from "./roles"

export type { Rol } from "./roles"

export class NoAutenticadoError extends Error {
    constructor() {
        super("No autenticado")
        this.name = "NoAutenticadoError"
    }
}

export class NoAutorizadoError extends Error {
    constructor() {
        super("No autorizado")
        this.name = "NoAutorizadoError"
    }
}

export async function getSession() {
    return getAuth().api.getSession({
        headers: await headers(),
    })
}

/** Se lee de la base, no de la cookie. */
export async function getUserRole(): Promise<Rol | null> {
    const session = await getSession()
    if (!session) return null
    return rolDeUsuario(session.user.id)
}

export async function requiereAuth() {
    const session = await getSession()
    if (!session) throw new NoAutenticadoError()
    return session
}

export async function requireRol(permitidos: Rol | readonly Rol[]) {
    const session = await requiereAuth()
    const rol = await rolDeUsuario(session.user.id)
    if (!tieneRol(rol, permitidos)) throw new NoAutorizadoError()
    return { session, rol }
}
