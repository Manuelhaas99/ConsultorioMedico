// Roles de usuario y comprobaciones puras sobre ellos (sin I/O). Ver roles.test.ts.

import { rolEnum } from "@/lib/db/schema"

/** Roles válidos, tomados del enum `rol` de la base para que nunca diverjan. */
export const ROLES = rolEnum.enumValues

export type Rol = (typeof ROLES)[number]

/** Indica si `rol` (el del usuario, o `null` si no se conoce) está entre los `permitidos`. */
export function tieneRol(rol: Rol | null | undefined, permitidos: Rol | readonly Rol[]): boolean {
    if (rol == null) return false
    const lista: readonly Rol[] = typeof permitidos === "string" ? [permitidos] : permitidos
    return lista.includes(rol)
}
