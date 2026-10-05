import "server-only"
import { headers } from "next/headers"
import { getAuth } from "@/lib/auth/index"
import { rolDeUsuario } from "./repositorio"
import { tieneRol, type Rol } from "./roles"

export type { Rol } from "./roles"

/** No hay sesión válida. El handler lo traduce a 401. */
export class NoAutenticadoError extends Error {
    constructor() {
        super("No autenticado")
        this.name = "NoAutenticadoError"
    }
}

/** Hay sesión, pero el usuario no tiene el rol requerido. El handler lo traduce a 403. */
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

/** Rol del usuario con sesión (leído de la base, no de la cookie), o `null` sin sesión. */
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

/**
 * Exige sesión y que el usuario tenga alguno de los roles `permitidos`.
 * Lanza `NoAutenticadoError` o `NoAutorizadoError`.
 */
export async function requireRol(permitidos: Rol | readonly Rol[]) {
    const session = await requiereAuth()
    const rol = await rolDeUsuario(session.user.id)
    if (!tieneRol(rol, permitidos)) throw new NoAutorizadoError()
    return { session, rol }
}
