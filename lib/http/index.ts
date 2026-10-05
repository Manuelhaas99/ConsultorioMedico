import "server-only"
import { NextResponse } from "next/server"
import { z } from "zod"

/** Cuerpo estándar de error de la API. */
export type ErrorApi = {
    message: string
    errores?: Record<string, string[]>
}

export function errorJson(status: number, message: string, errores?: ErrorApi["errores"]) {
    return NextResponse.json<ErrorApi>({ message, ...(errores && { errores }) }, { status })
}

type Resultado<T> = { ok: true; data: T } | { ok: false; response: NextResponse<ErrorApi> }

function aResultado<T>(parsed: z.ZodSafeParseResult<T>): Resultado<T> {
    if (parsed.success) return { ok: true, data: parsed.data }
    return {
        ok: false,
        response: errorJson(400, "Datos inválidos", z.flattenError(parsed.error).fieldErrors as Record<string, string[]>),
    }
}

/** Lee y valida el cuerpo JSON de la petición. Devuelve 400 si no es JSON o no cumple el esquema. */
export async function leerCuerpo<S extends z.ZodType>(request: Request, schema: S): Promise<Resultado<z.output<S>>> {
    let json: unknown
    try {
        json = await request.json()
    } catch {
        return { ok: false, response: errorJson(400, "El cuerpo debe ser JSON válido") }
    }
    return aResultado(schema.safeParse(json))
}

/** Valida los query params de la petición contra un esquema de objeto. */
export function leerQuery<S extends z.ZodType>(request: Request, schema: S): Resultado<z.output<S>> {
    const params = Object.fromEntries(new URL(request.url).searchParams)
    return aResultado(schema.safeParse(params))
}
