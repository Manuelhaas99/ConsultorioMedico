import "server-only"
import { Resend } from "resend"
import { env } from "@/lib/env"

let instancia: Resend | null = null

export function getResend(): Resend {
    if (!instancia) instancia = new Resend(env("resend").RESEND_API_KEY)
    return instancia
}
