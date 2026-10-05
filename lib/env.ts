import "server-only"
import { z } from "zod"

// Variables de entorno del servidor, validadas con zod en un solo lugar.
//
// Cada integración lee SOLO su grupo y lo hace de forma perezosa (al primer uso,
// no al importar el módulo): así `next build` no necesita secretos y un endpoint
// que no envía correos no falla porque falte RESEND_API_KEY.
//
// Los valores vacíos (`VAR=` en .env) cuentan como ausentes.

export type FuenteEntorno = Record<string, string | undefined>

/** Falta una variable o tiene un formato inválido. El mensaje nombra variables, nunca valores. */
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
        /** Conexiones máximas del Pool por instancia (ver lib/db/pool.ts). */
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
        /** Remitente con dominio verificado en Resend: `Nombre <citas@dominio>` o `citas@dominio`. */
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

/**
 * Valida un grupo de variables contra su esquema (pura, sin caché).
 * Lanza `ConfiguracionEntornoError` con la lista de variables faltantes o inválidas.
 */
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

/** Variables del grupo, validadas contra `process.env` la primera vez que se piden. */
export function env<G extends GrupoEntorno>(grupo: G): Entorno<G> {
    if (!cache.has(grupo)) cache.set(grupo, leerEntorno(grupo, process.env))
    return cache.get(grupo) as Entorno<G>
}
