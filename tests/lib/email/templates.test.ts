import { afterEach, describe, expect, it } from "vitest"
import { escaparHtml } from "@/lib/email/html"
import {
    asuntoCodigo,
    asuntoConfirmacion,
    asuntoEnlaceAcceso,
    asuntoRecordatorio,
    enlaceDeLaApp,
    ESTILO_BOTON,
    templateCodigo,
    templateConfirmacionCita,
    templateEnlaceAcceso,
    templateRecordatorioCita,
    textoCodigo,
    textoEnlaceAcceso,
    textosConfirmacion,
    type PropositoCodigo,
} from "@/lib/email/templates"

const base = {
    estado: "pendiente" as const,
    nombrePaciente: "Ana",
    nombreDoctor: "Dra. López",
    especialidad: "Odontología",
    fechaInicio: new Date("2026-10-12T15:00:00.000Z"),
    fechaFin: new Date("2026-10-12T15:30:00.000Z"),
    baseUrl: "https://citas.example",
}

const tzOriginal = process.env.TZ
afterEach(() => {
    process.env.TZ = tzOriginal
})

describe("correos de citas en la zona del consultorio", () => {
    it.each(["UTC", "America/Mexico_City", "Asia/Tokyo"])("la confirmación muestra 09:00–09:30 con TZ=%s", (tz) => {
        process.env.TZ = tz
        const html = templateConfirmacionCita(base)
        expect(html).toContain("lunes, 12 de octubre de 2026")
        expect(html).toContain("09:00 - 09:30")
    })

    it.each(["UTC", "America/Mexico_City", "Asia/Tokyo"])("el recordatorio muestra 09:00 con TZ=%s", (tz) => {
        process.env.TZ = tz
        const html = templateRecordatorioCita({ ...base, tiempoRestante: "1h", citaId: "c1", invitado: false })
        expect(html).toContain("lunes, 12 de octubre de 2026")
        expect(html).toContain("<strong>Hora:</strong> 09:00")
    })
})

describe("correos sin inyección de HTML", () => {
    const malicioso = '<a href="https://evil.example">Haz clic</a>'
    const props = {
        ...base,
        nombrePaciente: malicioso,
        nombreDoctor: "Dr. <script>alert(1)</script>",
        especialidad: "<img src=x onerror=alert(1)>",
        direccion: '"><b>Calle</b>',
    }

    it("la confirmación escapa todos los datos interpolados", () => {
        const html = templateConfirmacionCita(props)
        expect(html).not.toContain("<a href=\"https://evil.example\"")
        expect(html).not.toContain("<script>")
        expect(html).not.toContain("<img")
        expect(html).not.toContain("<b>Calle</b>")
        expect(html).toContain("&lt;a href=&quot;https://evil.example&quot;&gt;Haz clic&lt;/a&gt;")
    })

    it("el recordatorio escapa todos los datos interpolados", () => {
        const html = templateRecordatorioCita({ ...props, tiempoRestante: "24h", citaId: "c1", invitado: false })
        expect(html).not.toContain("<script>")
        expect(html).not.toContain("<img")
        expect(html).toContain("&lt;a href=")
    })

    it("codifica el token en el enlace de gestión", () => {
        const html = templateConfirmacionCita({ ...props, tokenGestion: 'abc"><x' })
        expect(html).toContain('href="https://citas.example/cita#token=abc%22%3E%3Cx"')
    })

    it("omite el enlace si la URL base no es http(s)", () => {
        const html = templateConfirmacionCita({ ...props, tokenGestion: "abc", baseUrl: "javascript:alert(1)" })
        expect(html).not.toContain("<a ")
    })

    it("los asuntos son de una sola línea", () => {
        expect(asuntoConfirmacion("Ana\r\nBcc: x@example.com", "pendiente")).toBe("Recibimos tu solicitud de cita con Ana Bcc: x@example.com")
        expect(asuntoRecordatorio("Ana\n", "1h")).toBe("Recordatorio: cita con Ana en 1 hora")
    })
})

describe("enlaces de gestión sin exponer el token", () => {
    const props = { ...base, baseUrl: "https://citas.example" }

    it("la confirmación del invitado lleva el token en el fragmento, no en la query", () => {
        const html = templateConfirmacionCita({ ...props, tokenGestion: "AbC_123-xyz" })
        expect(html).toContain('href="https://citas.example/cita#token=AbC_123-xyz"')
        expect(html).not.toContain("?token=")
    })

    it("sin token (paciente con cuenta) no hay enlace de gestión", () => {
        expect(templateConfirmacionCita(props)).not.toContain("/cita")
    })

    it("el recordatorio del paciente con cuenta enlaza a /mis-citas", () => {
        const html = templateRecordatorioCita({ ...props, tiempoRestante: "1h", citaId: "c1", invitado: false })
        expect(html).toContain('href="https://citas.example/mis-citas"')
    })

    it("el recordatorio del invitado no incluye token y remite al correo de confirmación", () => {
        const html = templateRecordatorioCita({ ...props, tiempoRestante: "1h", citaId: "c1", invitado: true })
        expect(html).not.toContain("token")
        expect(html).not.toContain("<a ")
        expect(html).toContain("correo de confirmación")
    })
})

describe("textos consistentes con el estado de la cita", () => {
    it("una cita pendiente no se anuncia como confirmada", () => {
        const html = templateConfirmacionCita(base)
        expect(html).toContain("Recibimos tu solicitud de cita")
        expect(html).not.toMatch(/confirmada/i)
        expect(asuntoConfirmacion("Dra. López", "pendiente")).toBe("Recibimos tu solicitud de cita con Dra. López")
    })

    it("no promete avisos que el sistema no envía", () => {
        expect(textosConfirmacion("pendiente").mensaje).not.toMatch(/avisaremos|te avisamos|notificaremos/i)
        expect(textosConfirmacion("pendiente").mensaje).toMatch(/pendiente/i)
    })

    it("una cita confirmada se anuncia como agendada", () => {
        expect(templateConfirmacionCita({ ...base, estado: "confirmada" })).toContain("Cita agendada")
        expect(asuntoConfirmacion("Dra. López", "confirmada")).toBe("Cita agendada con Dra. López")
        expect(textosConfirmacion("confirmada").titulo).toBe("Cita agendada")
    })

    it("muestra la especialidad y la dirección que se le pasan", () => {
        const html = templateConfirmacionCita({ ...base, especialidad: "Ortodoncia", direccion: "Av. Juárez 10, CDMX" })
        expect(html).toContain("<strong>Especialidad:</strong> Ortodoncia")
        expect(html).toContain("<strong>Dirección:</strong> Av. Juárez 10, CDMX")
    })

    it("sin dirección no muestra la fila", () => {
        expect(templateConfirmacionCita(base)).not.toContain("Dirección")
    })
})

describe("correos de acceso", () => {
    const baseUrl = "https://citas.example"
    const urlValida = "https://citas.example/api/auth/magic-link/verify?token=abc123&callbackURL=%2F"
    const codigo = { codigo: "123456", proposito: "iniciar-sesion" as const, minutosVigencia: 10 }
    const enlace = { url: urlValida, minutosVigencia: 10, baseUrl }

    function preheader(html: string): string {
        return /<div style="display:none[^"]*">([^<]*)<\/div>/.exec(html)?.[1] ?? ""
    }

    const textosPorProposito: ReadonlyArray<[PropositoCodigo, string, string, string, string]> = [
        [
            "iniciar-sesion",
            "Tu código para entrar a Citas Dentales",
            "Tu código para entrar",
            "Escribe este código en Citas Dentales para entrar.",
            "Úsalo para entrar a Citas Dentales. Vence en 10 minutos.",
        ],
        [
            "verificar-correo",
            "Tu código para verificar tu correo en Citas Dentales",
            "Tu código para verificar tu correo",
            "Escribe este código para verificar tu correo.",
            "Úsalo para verificar tu correo en Citas Dentales. Vence en 10 minutos.",
        ],
        [
            "restablecer-contrasena",
            "Tu código para restablecer tu contraseña en Citas Dentales",
            "Tu código para restablecer tu contraseña",
            "Escribe este código para elegir una contraseña nueva.",
            "Úsalo para restablecer tu contraseña en Citas Dentales. Vence en 10 minutos.",
        ],
    ]

    it.each(textosPorProposito)("%s: asunto, título, intro y preheader", (proposito, asunto, titulo, intro, textoPreheader) => {
        expect(asuntoCodigo(proposito)).toBe(asunto)
        expect(asuntoCodigo(proposito)).not.toMatch(/[\r\n]/)
        expect(asuntoCodigo(proposito)).not.toContain("123456")
        const html = templateCodigo({ ...codigo, proposito })
        expect(html).toContain(titulo)
        expect(html).toContain(intro)
        expect(preheader(html)).toBe(textoPreheader)
    })

    it("el preheader va antes del título y nunca lleva el código", () => {
        const html = templateCodigo(codigo)
        expect(html.indexOf("display:none")).toBeLessThan(html.indexOf("<h2"))
        expect(preheader(html)).not.toBe("")
        expect(preheader(html)).not.toContain("123456")
    })

    it("el correo del enlace lleva su preheader", () => {
        const html = templateEnlaceAcceso(enlace)
        expect(preheader(html)).toBe("Úsalo para entrar a Citas Dentales. Vence en 10 minutos.")
        expect(html.indexOf("display:none")).toBeLessThan(html.indexOf("<h2"))
    })

    it("el asunto del enlace es fijo", () => {
        expect(asuntoEnlaceAcceso()).toBe("Tu enlace para entrar a Citas Dentales")
    })

    it("muestra la vigencia que se le pasa, en singular con 1", () => {
        expect(templateCodigo(codigo)).toContain("Vence en 10 minutos y solo funciona una vez.")
        expect(textoCodigo({ ...codigo, minutosVigencia: 1 })).toContain("Vence en 1 minuto y solo funciona una vez.")
        const vigenciaEnlace = "Ábrelo en el mismo teléfono o computadora donde lo pediste."
        expect(templateEnlaceAcceso({ ...enlace, minutosVigencia: 1 })).toContain(`Vence en 1 minuto. ${vigenciaEnlace}`)
        expect(textoEnlaceAcceso(enlace)).toContain(`Vence en 10 minutos. ${vigenciaEnlace}`)
    })

    it("el código va contiguo, sin espacios reales", () => {
        for (const contenido of [templateCodigo(codigo), textoCodigo(codigo)]) expect(contenido).toContain("123456")
        expect(templateCodigo(codigo)).toContain("letter-spacing")
    })

    it.each<[PropositoCodigo, string]>([
        [
            "iniciar-sesion",
            "Si no pediste este código, ignora este correo. Nadie puede entrar a tu cuenta sin él. Nunca te lo pediremos por teléfono ni por mensaje.",
        ],
        ["verificar-correo", "Si no pediste este código, ignora este correo. Nunca te lo pediremos por teléfono ni por mensaje."],
        ["restablecer-contrasena", "Si no pediste este código, ignora este correo. Nunca te lo pediremos por teléfono ni por mensaje."],
    ])("%s: lleva su aviso", (proposito, aviso) => {
        for (const contenido of [templateCodigo({ ...codigo, proposito }), textoCodigo({ ...codigo, proposito })]) {
            expect(contenido).toContain(aviso)
            if (proposito !== "iniciar-sesion") expect(contenido).not.toContain("Nadie puede entrar")
        }
    })

    it("el enlace lleva su aviso", () => {
        const aviso = "Si no pediste este enlace, ignora este correo. Nunca te lo pediremos por teléfono ni por mensaje."
        expect(templateEnlaceAcceso(enlace)).toContain(aviso)
        expect(textoEnlaceAcceso(enlace)).toContain(aviso)
    })

    it("no saludan ni contienen correos electrónicos", () => {
        const correos = [templateCodigo(codigo), textoCodigo(codigo), templateEnlaceAcceso(enlace), textoEnlaceAcceso(enlace)]
        for (const contenido of correos) {
            expect(contenido).not.toContain("Hola")
            expect(contenido).not.toMatch(/[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}/i)
        }
    })

    it("el texto plano no lleva etiquetas HTML", () => {
        expect(textoCodigo(codigo)).not.toMatch(/<[a-z]/i)
        expect(textoEnlaceAcceso(enlace)).not.toMatch(/<[a-z]/i)
    })

    it("el texto plano del enlace no menciona un botón y deja la URL en su propia línea", () => {
        expect(textoEnlaceAcceso(enlace)).toBe(
            [
                "Tu enlace para entrar",
                "Abre este enlace para entrar a Citas Dentales. Sirve una sola vez:",
                urlValida,
                "Vence en 10 minutos. Ábrelo en el mismo teléfono o computadora donde lo pediste.",
                "Si no pediste este enlace, ignora este correo. Nunca te lo pediremos por teléfono ni por mensaje.",
            ].join("\n\n"),
        )
        expect(textoEnlaceAcceso(enlace)).not.toMatch(/botón/i)
    })

    it.each(["<script>alert(1)</script>", '"><img src=x onerror=alert(1)>'])("escapa el código %j", (malicioso) => {
        const html = templateCodigo({ ...codigo, codigo: malicioso })
        expect(html).not.toContain("<script>")
        expect(html).not.toContain("<img")
        expect(html).toContain("&lt;")
    })

    it("escapa la URL del enlace", () => {
        const html = templateEnlaceAcceso({ ...enlace, url: `https://citas.example/a'b?x="><img src=x onerror=alert(1)><script>` })
        expect(html).not.toContain("<img")
        expect(html).not.toContain("<script>")
        expect(html).toContain("a&#39;b")
    })

    it("con una URL del origen de la app muestra el botón y el respaldo", () => {
        const html = templateEnlaceAcceso(enlace)
        expect(html).toContain(`href="${escaparHtml(urlValida)}"`)
        expect(html).toContain(`style="${ESTILO_BOTON}"`)
        expect(html).toContain("Entrar a Citas Dentales")
        expect(html).toContain(`copia y pega este enlace en tu navegador:<br>${escaparHtml(urlValida)}</p>`)
        expect(textoEnlaceAcceso(enlace)).toContain(urlValida)
    })

    it("normaliza la URL antes de ponerla en el href", () => {
        const html = templateEnlaceAcceso({ ...enlace, url: "HTTPS://CITAS.EXAMPLE/api/auth/magic-link/verify?token=abc" })
        expect(html).toContain('href="https://citas.example/api/auth/magic-link/verify?token=abc"')
    })

    it.each([
        ["sin baseUrl", { url: urlValida, baseUrl: "" }],
        ["javascript:", { url: "javascript:alert(1)", baseUrl }],
        ["ftp", { url: "ftp://citas.example/archivo", baseUrl }],
        ["data:", { url: "data:text/html,<script>alert(1)</script>", baseUrl }],
        ["otro origen", { url: "https://evil.example/api/auth/magic-link/verify?token=abc", baseUrl }],
        ["relativa al protocolo", { url: "//evil.example/x", baseUrl }],
        ["otro puerto", { url: "https://citas.example:8443/x", baseUrl }],
        ["http con base https", { url: "http://citas.example/x", baseUrl }],
        ["con credenciales", { url: "https://evil@citas.example/x", baseUrl }],
    ])("omite el botón y la URL (%s)", (_, props) => {
        const html = templateEnlaceAcceso({ ...props, minutosVigencia: 10 })
        expect(html).not.toContain("<a ")
        expect(html).toContain("No pudimos generar tu enlace. Vuelve a Citas Dentales y pide uno nuevo.")
        expect(enlaceDeLaApp(props.url, props.baseUrl)).toBeNull()
        const texto = textoEnlaceAcceso({ ...props, minutosVigencia: 10 })
        expect(texto).not.toContain(props.url)
        expect(texto).toContain("No pudimos generar tu enlace.")
    })
})
