// La búsqueda es por hash (índice único), así que no hay comparación de secretos
// en código que pueda filtrar tiempos.

import { createHash, randomBytes } from "node:crypto"
import { z } from "zod"

const BYTES_TOKEN = 32

export function hashTokenGestion(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex")
}

export function generarTokenGestion(): { token: string; hash: string } {
    const token = randomBytes(BYTES_TOKEN).toString("base64url")
    return { token, hash: hashTokenGestion(token) }
}

export const tokenGestionSchema = z
    .string({ error: "Falta el token de gestión" })
    .regex(/^[A-Za-z0-9_-]{43}$/, { error: "El token de gestión no es válido" })
