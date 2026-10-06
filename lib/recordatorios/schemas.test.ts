import { describe, expect, it } from "vitest"
import { mensajeRecordatorioSchema } from "./schemas"

const valido = {
    citaId: "6f1c1b7e-0000-4000-8000-000000000001",
    tipo: "1h",
    fechaInicio: "2026-10-12T15:00:00.000Z",
}

describe("mensajeRecordatorioSchema", () => {
    it("acepta el cuerpo que publica programarRecordatorios y convierte la fecha", () => {
        expect(mensajeRecordatorioSchema.parse(valido)).toEqual({ ...valido, fechaInicio: new Date(valido.fechaInicio) })
    })

    it("acepta fechas con desfase horario", () => {
        const r = mensajeRecordatorioSchema.parse({ ...valido, fechaInicio: "2026-10-12T09:00:00-06:00" })
        expect(r.fechaInicio.toISOString()).toBe("2026-10-12T15:00:00.000Z")
    })

    it.each([
        ["citaId no es uuid", { ...valido, citaId: "1" }],
        ["tipo desconocido", { ...valido, tipo: "2h" }],
        ["sin fechaInicio (mensajes anteriores a este cambio)", { citaId: valido.citaId, tipo: "1h" }],
        ["fecha inválida", { ...valido, fechaInicio: "mañana" }],
    ])("rechaza: %s", (_caso, cuerpo) => {
        expect(mensajeRecordatorioSchema.safeParse(cuerpo).success).toBe(false)
    })

    it("ignora un correo en el cuerpo: el destinatario sale de la base", () => {
        const r = mensajeRecordatorioSchema.parse({ ...valido, emailPaciente: "otro@example.com" })
        expect(r).not.toHaveProperty("emailPaciente")
    })
})
