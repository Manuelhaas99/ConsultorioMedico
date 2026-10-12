import "server-only"
import { z } from "zod"

// Agrupadas por integración y leídas al primer uso: así `next build` no necesita
// secretos y un endpoint sin correo no falla porque falte RESEND_API_KEY.

export type FuenteEntorno = Record<string, string | undefined>

/** El mensaje nombra variables, nunca sus valores. */
export class ConfiguracionEntornoError extends Error {
    constructor(mensaje: string) {
        super(mensaje)
        this.name = "ConfiguracionEntornoError"
    }
}

const texto = z.string().trim().min(1)
const url = z.url({ protocol: /^https?$/ })

const esquemas = {
    baseDatos: z.object({
        DATABASE_URL: texto,
        DATABASE_SSL: texto.optional(),
        DATABASE_CA_CERT: texto.optional(),
        DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).optional(),
    }),
    auth: z
        .object({
            BETTER_AUTH_SECRET: texto.min(32, "debe tener al menos 32 caracteres"),
            BETTER_AUTH_URL: url,
            GOOGLE_CLIENT_ID: texto.optional(),
            GOOGLE_CLIENT_SECRET: texto.optional(),
        })
        .refine((v) => (v.GOOGLE_CLIENT_ID === undefined) === (v.GOOGLE_CLIENT_SECRET === undefined), {
            message: "GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET van juntos (ambos o ninguno)",
            path: ["GOOGLE_CLIENT_SECRET"],
        }),
    /** URL pública de la app: enlaces en correos y destino de los webhooks de QStash. */
    app: z.object({
        BETTER_AUTH_URL: url,
    }),
    resend: z.object({
        RESEND_API_KEY: texto,
    }),
    correo: z.object({
        /** Debe tener dominio verificado en Resend. */
        EMAIL_FROM: texto
            .regex(/^(?:[^<>@\r\n]+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)$/, {
                message: 'debe ser "Nombre <correo@dominio>" o "correo@dominio"',
            })
            .optional(),
        NODE_ENV: z.string().optional(),
    }),
    qstashPublicacion: z.object({
        QSTASH_TOKEN: texto,
        QSTASH_URL: url.optional(),
    }),
    qstashFirma: z.object({
        QSTASH_CURRENT_SIGNING_KEY: texto,
        QSTASH_NEXT_SIGNING_KEY: texto,
    }),
} satisfies Record<string, z.ZodType<object>>

export type GrupoEntorno = keyof typeof esquemas
export type Entorno<G extends GrupoEntorno> = z.output<(typeof esquemas)[G]>

function sinVacios(fuente: FuenteEntorno): FuenteEntorno {
    return Object.fromEntries(Object.entries(fuente).map(([k, v]) => [k, v?.trim() === "" ? undefined : v]))
}

export function leerEntorno<G extends GrupoEntorno>(grupo: G, fuente: FuenteEntorno): Entorno<G> {
    const limpia = sinVacios(fuente)
    const resultado = esquemas[grupo].safeParse(limpia)
    if (resultado.success) return resultado.data as Entorno<G>
    const detalles = resultado.error.issues.map((issue) => {
        const variable = String(issue.path[0] ?? grupo)
        const falta = issue.code === "invalid_type" && limpia[variable] === undefined
        return falta ? `${variable}: falta` : `${variable}: ${issue.message}`
    })
    throw new ConfiguracionEntornoError(`Variables de entorno inválidas (${grupo}): ${detalles.join("; ")}`)
}

const cache = new Map<GrupoEntorno, unknown>()

export function env<G extends GrupoEntorno>(grupo: G): Entorno<G> {
    if (!cache.has(grupo)) cache.set(grupo, leerEntorno(grupo, process.env))
    return cache.get(grupo) as Entorno<G>
}
