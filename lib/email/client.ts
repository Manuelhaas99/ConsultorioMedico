import "server-only"
import { Resend } from "resend"
import { env } from "@/lib/env"

let instancia: Resend | null = null

/** Cliente de Resend, creado al primer envío (no al importar) para que el build no necesite RESEND_API_KEY. */
export function getResend(): Resend {
    if (!instancia) instancia = new Resend(env("resend").RESEND_API_KEY)
    return instancia
}
