// Utilidades puras para construir correos sin inyección (sin I/O). Ver html.test.ts.

const ENTIDADES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "`": "&#96;",
}

/**
 * Escapa un valor para interpolarlo en HTML, tanto en texto como dentro de un
 * atributo entre comillas. Todo dato del usuario o de la base pasa por aquí.
 */
export function escaparHtml(valor: string): string {
    return valor.replace(/[&<>"'`]/g, (c) => ENTIDADES[c] ?? c)
}

/**
 * Plantilla etiquetada que escapa cada valor interpolado. Para insertar HTML ya
 * construido (otro fragmento de plantilla) se envuelve en `HtmlSeguro`.
 *
 * @example html`<p>Hola ${nombre}</p>`
 */
export function html(partes: TemplateStringsArray, ...valores: ReadonlyArray<ValorHtml>): HtmlSeguro {
    let salida = partes[0] ?? ""
    valores.forEach((valor, i) => {
        salida += aHtml(valor) + (partes[i + 1] ?? "")
    })
    return new HtmlSeguro(salida)
}

/** HTML que ya es seguro (producido por `html`); no se vuelve a escapar. */
export class HtmlSeguro {
    constructor(readonly valor: string) {}
    toString(): string {
        return this.valor
    }
}

type ValorHtml = string | number | HtmlSeguro | null | undefined | false

function aHtml(valor: ValorHtml): string {
    if (valor === null || valor === undefined || valor === false) return ""
    if (valor instanceof HtmlSeguro) return valor.valor
    return escaparHtml(String(valor))
}

/**
 * Construye una URL absoluta `http(s)` a partir de una base de confianza (la URL
 * de la app) y una ruta, codificando los parámetros. Devuelve `null` si la base
 * falta o no es `http(s)`, para no generar enlaces rotos ni `javascript:`.
 *
 * Los secretos (p. ej. el token de gestión) van en `fragmento` (`#clave=valor`):
 * el navegador no envía el fragmento al servidor ni lo incluye en `Referer`.
 */
export function construirUrl(
    base: string | undefined,
    ruta: string,
    parametros: Readonly<Record<string, string>> = {},
    fragmento: Readonly<Record<string, string>> = {},
): string | null {
    if (!base) return null
    let url: URL
    try {
        url = new URL(ruta, base)
    } catch {
        return null
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    for (const [clave, valor] of Object.entries(parametros)) url.searchParams.set(clave, valor)
    const hash = new URLSearchParams(fragmento).toString()
    if (hash) url.hash = hash
    return url.toString()
}

/** Longitud máxima del asunto de un correo. */
export const ASUNTO_MAX = 150

/**
 * Normaliza texto para una cabecera de una sola línea (asunto): quita saltos de
 * línea y caracteres de control que permitirían inyectar cabeceras, colapsa
 * espacios y recorta a `max` caracteres.
 */
export function textoDeUnaLinea(valor: string, max: number = ASUNTO_MAX): string {
    const limpio = valor.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim()
    return limpio.length > max ? `${limpio.slice(0, max - 1).trimEnd()}…` : limpio
}
