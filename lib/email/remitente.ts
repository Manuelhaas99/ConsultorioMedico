import { ConfiguracionEntornoError } from "@/lib/env"

/** Remitente de pruebas de Resend: solo entrega al dueño de la cuenta. */
export const REMITENTE_DESARROLLO = "Citas Médicas <onboarding@resend.dev>"

export function resolverRemitente({ EMAIL_FROM, NODE_ENV }: { EMAIL_FROM?: string; NODE_ENV?: string }): string {
    if (EMAIL_FROM) return EMAIL_FROM
    if (NODE_ENV === "production") {
        throw new ConfiguracionEntornoError(
            "Variables de entorno inválidas (correo): EMAIL_FROM: falta (en producción se requiere un remitente con dominio verificado en Resend)",
        )
    }
    return REMITENTE_DESARROLLO
}
