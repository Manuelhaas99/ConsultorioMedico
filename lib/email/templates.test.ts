import { afterEach, describe, expect, it } from "vitest"
import { asuntoConfirmacion, asuntoRecordatorio, templateConfirmacionCita, templateRecordatorioCita, textosConfirmacion } from "./templates"

const base = {
    estado: "pendiente" as const,
    nombrePaciente: "Ana",
    nombreDoctor: "Dra. López",
    especialidad: "Odontología",
    fechaInicio: new Date("2026-10-12T15:00:00.000Z"),
    fechaFin: new Date("2026-10-12T15:30:00.000Z"),
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
        baseUrl: "https://citas.example",
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
