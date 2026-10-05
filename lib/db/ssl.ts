// Configuración TLS de la conexión a Postgres (pura, sin I/O). Ver ssl.test.ts.
//
// Por defecto el certificado del servidor SIEMPRE se verifica (cadena y nombre
// de host), con las CA del sistema o con la que se dé en DATABASE_CA_CERT.
// Desactivar TLS es una decisión explícita (DATABASE_SSL=disable o
// sslmode=disable), pensada para un Postgres local o de CI sin SSL. No existe
// un modo que acepte cualquier certificado.

/** Opciones TLS que acepta `pg` (subconjunto de `tls.ConnectionOptions`). */
export type SslVerificado = { rejectUnauthorized: true; ca?: string }

export type ConfiguracionConexion = {
    /** DATABASE_URL sin los parámetros `sslmode`/`ssl`, que ya quedaron resueltos en `ssl`. */
    connectionString: string
    ssl: false | SslVerificado
}

export type VariablesBaseDatos = {
    DATABASE_URL?: string
    /** `disable` para conectarse sin TLS; `verify-full` (o vacío) para verificar el certificado. */
    DATABASE_SSL?: string
    /** Certificado CA del proveedor en PEM (admite `\n` escapados, como suelen guardarlo los paneles de variables). */
    DATABASE_CA_CERT?: string
}

export class ConfiguracionBaseDatosError extends Error {
    constructor(mensaje: string) {
        super(mensaje)
        this.name = "ConfiguracionBaseDatosError"
    }
}

/** Valores de `sslmode` (libpq) que se traducen a TLS con verificación completa. */
const MODOS_VERIFICADOS = new Set(["require", "verify-ca", "verify-full", "prefer", "allow"])

/** Parámetros de la URL que `pg` usaría para construir su propio `ssl` y pisar el nuestro. */
const PARAMETROS_SSL_RESUELTOS = ["sslmode", "ssl"] as const
const PARAMETROS_CERTIFICADO = ["sslrootcert", "sslcert", "sslkey"] as const

function leerCa(valor: string | undefined): string | undefined {
    const pem = valor?.trim().replace(/\\n/g, "\n")
    if (!pem) return undefined
    if (!pem.includes("-----BEGIN CERTIFICATE-----")) {
        throw new ConfiguracionBaseDatosError("DATABASE_CA_CERT debe ser un certificado en formato PEM (-----BEGIN CERTIFICATE-----)")
    }
    return pem
}

/**
 * Resuelve la configuración TLS a partir de las variables de entorno.
 * Lanza `ConfiguracionBaseDatosError` si falta la URL, si se pide un modo que no
 * verifica el certificado (`sslmode=no-verify`) o si los valores se contradicen.
 */
export function configuracionConexion(env: VariablesBaseDatos): ConfiguracionConexion {
    const original = env.DATABASE_URL?.trim()
    if (!original) throw new ConfiguracionBaseDatosError("DATABASE_URL no está definida")

    let url: URL
    try {
        url = new URL(original)
    } catch {
        throw new ConfiguracionBaseDatosError("DATABASE_URL no es una URL válida")
    }

    const modoEnv = env.DATABASE_SSL?.trim().toLowerCase() || undefined
    if (modoEnv !== undefined && modoEnv !== "disable" && modoEnv !== "verify-full") {
        throw new ConfiguracionBaseDatosError('DATABASE_SSL solo admite "disable" o "verify-full"')
    }

    const sslmode = url.searchParams.get("sslmode")?.toLowerCase() ?? null
    const ssl = url.searchParams.get("ssl")?.toLowerCase() ?? null
    if (sslmode === "no-verify" || ssl === "no-verify") {
        throw new ConfiguracionBaseDatosError(
            "sslmode=no-verify acepta cualquier certificado; usa sslmode=verify-full y, si el proveedor usa una CA propia, DATABASE_CA_CERT",
        )
    }
    if (sslmode !== null && sslmode !== "disable" && !MODOS_VERIFICADOS.has(sslmode)) {
        throw new ConfiguracionBaseDatosError(`sslmode=${sslmode} no es un valor válido`)
    }

    const urlPideSinTls = sslmode === "disable" || ssl === "false" || ssl === "0"
    const urlPideTls = (sslmode !== null && sslmode !== "disable") || ssl === "true" || ssl === "1"
    if ((modoEnv === "disable" && urlPideTls) || (modoEnv === "verify-full" && urlPideSinTls)) {
        throw new ConfiguracionBaseDatosError("DATABASE_SSL contradice el sslmode de DATABASE_URL")
    }

    const ca = leerCa(env.DATABASE_CA_CERT)
    if (ca && PARAMETROS_CERTIFICADO.some((p) => url.searchParams.has(p))) {
        throw new ConfiguracionBaseDatosError("Usa DATABASE_CA_CERT o sslrootcert/sslcert/sslkey en DATABASE_URL, no ambos")
    }

    const sinTls = modoEnv === "disable" || urlPideSinTls
    if (sinTls && PARAMETROS_CERTIFICADO.some((p) => url.searchParams.has(p))) {
        throw new ConfiguracionBaseDatosError("sslrootcert/sslcert/sslkey no tienen sentido con TLS desactivado")
    }

    // Quitamos sslmode/ssl: si los dejáramos, pg construiría su propio `ssl` y descartaría el nuestro.
    for (const p of PARAMETROS_SSL_RESUELTOS) url.searchParams.delete(p)
    const connectionString = url.toString()

    if (sinTls) return { connectionString, ssl: false }
    return { connectionString, ssl: ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true } }
}
