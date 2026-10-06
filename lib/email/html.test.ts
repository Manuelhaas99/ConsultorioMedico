import { describe, expect, it } from "vitest"
import { ASUNTO_MAX, construirUrl, escaparHtml, html, HtmlSeguro, textoDeUnaLinea } from "./html"

describe("escaparHtml", () => {
    it("escapa los caracteres especiales de HTML", () => {
        expect(escaparHtml(`<a href="x" onclick='y'>&\`</a>`)).toBe(
            "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&#96;&lt;/a&gt;",
        )
    })

    it("deja intacto el texto normal, con acentos", () => {
        expect(escaparHtml("Dra. María Núñez")).toBe("Dra. María Núñez")
    })

    it("no deja etiquetas aunque el valor ya traiga entidades", () => {
        expect(escaparHtml("&lt;b&gt;")).toBe("&amp;lt;b&amp;gt;")
    })
})

describe("html``", () => {
    it("escapa cada valor interpolado", () => {
        const nombre = "<a href=https://evil.example>Haz clic</a>"
        expect(html`<p>${nombre}</p>`.toString()).toBe("<p>&lt;a href=https://evil.example&gt;Haz clic&lt;/a&gt;</p>")
    })

    it("no vuelve a escapar fragmentos HtmlSeguro y omite null/undefined/false", () => {
        const interno = html`<b>${"x&y"}</b>`
        expect(interno).toBeInstanceOf(HtmlSeguro)
        expect(html`${interno}${null}${undefined}${false}${3}`.toString()).toBe("<b>x&amp;y</b>3")
    })

    it("un valor no puede cerrar el atributo", () => {
        const url = `https://ok.example/" onmouseover="alert(1)`
        expect(html`<a href="${url}">`.toString()).toBe('<a href="https://ok.example/&quot; onmouseover=&quot;alert(1)">')
    })
})

describe("construirUrl", () => {
    it("codifica los parámetros", () => {
        expect(construirUrl("https://citas.example", "/cita", { token: "a b&c=d\"<", accion: "cancelar" })).toBe(
            "https://citas.example/cita?token=a+b%26c%3Dd%22%3C&accion=cancelar",
        )
    })

    it("pone los secretos en el fragmento, codificados", () => {
        expect(construirUrl("https://citas.example", "/cita", {}, { token: "a+b/c", accion: "cancelar" })).toBe(
            "https://citas.example/cita#token=a%2Bb%2Fc&accion=cancelar",
        )
    })

    it.each([undefined, "", "no es url", "javascript:alert(1)", "ftp://citas.example"])("rechaza la base %s", (base) => {
        expect(construirUrl(base, "/cita")).toBeNull()
    })

    it("la ruta no puede cambiar el origen a otro protocolo", () => {
        expect(construirUrl("https://citas.example", "javascript:alert(1)")).toBeNull()
    })
})

describe("textoDeUnaLinea", () => {
    it("elimina saltos de línea y caracteres de control (inyección de cabeceras)", () => {
        expect(textoDeUnaLinea("Cita con Ana\r\nBcc: victima@example.com\u0000")).toBe("Cita con Ana Bcc: victima@example.com")
    })

    it("recorta a la longitud máxima", () => {
        const asunto = textoDeUnaLinea("x".repeat(500))
        expect(asunto.length).toBe(ASUNTO_MAX)
        expect(asunto.endsWith("…")).toBe(true)
    })
})
