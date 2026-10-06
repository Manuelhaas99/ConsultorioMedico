const ENTIDADES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "`": "&#96;",
}

/** Válido tanto en texto como dentro de un atributo entre comillas. */
export function escaparHtml(valor: string): string {
    return valor.replace(/[&<>"'`]/g, (c) => ENTIDADES[c] ?? c)
}

/** Escapa cada valor interpolado salvo los `HtmlSeguro` (fragmentos ya construidos con `html`). */
export function html(partes: TemplateStringsArray, ...valores: ReadonlyArray<ValorHtml>): HtmlSeguro {
    let salida = partes[0] ?? ""
    valores.forEach((valor, i) => {
        salida += aHtml(valor) + (partes[i + 1] ?? "")
    })
    return new HtmlSeguro(salida)
}

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
 * Devuelve `null` si la base falta o no es `http(s)`, para no generar enlaces rotos ni `javascript:`.
 * Los secretos van en `fragmento`: el navegador no lo envía al servidor ni en `Referer`.
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

export const ASUNTO_MAX = 150

/** Quita saltos de línea y caracteres de control que permitirían inyectar cabeceras. */
export function textoDeUnaLinea(valor: string, max: number = ASUNTO_MAX): string {
    const limpio = valor.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim()
    return limpio.length > max ? `${limpio.slice(0, max - 1).trimEnd()}…` : limpio
}
