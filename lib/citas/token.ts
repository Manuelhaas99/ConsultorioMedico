// Token de gestión para invitados (sin cuenta). Ver token.test.ts.
//
// El token en claro solo existe en la respuesta de creación y en el correo de
// confirmación; la base guarda su SHA-256. La búsqueda es por hash (índice único),
// así que no hay comparación de secretos en código que pueda filtrar tiempos.

import { createHash, randomBytes } from "node:crypto"
import { z } from "zod"

/** Bytes aleatorios del token (256 bits). */
const BYTES_TOKEN = 32

/** SHA-256 en hexadecimal del token, tal como se guarda en `cita.token_gestion_hash`. */
export function hashTokenGestion(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex")
}

/** Genera un token nuevo (base64url, 43 caracteres) y su hash. */
export function generarTokenGestion(): { token: string; hash: string } {
    const token = randomBytes(BYTES_TOKEN).toString("base64url")
    return { token, hash: hashTokenGestion(token) }
}

/**
 * Forma aceptada de un token de gestión: base64url de los tokens nuevos o el
 * hexadecimal de 64 caracteres de los emitidos antes de guardar solo el hash.
 */
export const tokenGestionSchema = z
    .string({ error: "Falta el token de gestión" })
    .regex(/^[A-Za-z0-9_-]{32,128}$/, { error: "El token de gestión no es válido" })
