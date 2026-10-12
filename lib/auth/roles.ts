import { rolEnum } from "@/lib/db/schema"

export const ROLES = rolEnum.enumValues

export type Rol = (typeof ROLES)[number]

export function tieneRol(rol: Rol | null | undefined, permitidos: Rol | readonly Rol[]): boolean {
    if (rol == null) return false
    const lista: readonly Rol[] = typeof permitidos === "string" ? [permitidos] : permitidos
    return lista.includes(rol)
}
