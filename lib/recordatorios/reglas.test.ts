import { describe, expect, it } from "vitest"
import { claveRecordatorio, motivoParaOmitir, recordatoriosPorProgramar, type EstadoRecordatorioCita } from "./reglas"
import type { MensajeRecordatorio } from "./schemas"

const CITA_ID = "6f1c1b7e-0000-4000-8000-000000000001"
const inicio = new Date("2026-10-12T15:00:00.000Z")

describe("recordatoriosPorProgramar", () => {
    it("programa 24 h y 1 h antes, con el horario de la cita en el cuerpo y sin correo", () => {
        const r = recordatoriosPorProgramar(CITA_ID, inicio, new Date("2026-10-10T00:00:00.000Z"))
        expect(r).toEqual([
            {
                tipo: "24h",
                enviarEn: new Date("2026-10-11T15:00:00.000Z"),
                cuerpo: { citaId: CITA_ID, tipo: "24h", fechaInicio: "2026-10-12T15:00:00.000Z" },
            },
            {
                tipo: "1h",
                enviarEn: new Date("2026-10-12T14:00:00.000Z"),
                cuerpo: { citaId: CITA_ID, tipo: "1h", fechaInicio: "2026-10-12T15:00:00.000Z" },
            },
        ])
    })

    it("omite los que ya pasaron", () => {
        const r = recordatoriosPorProgramar(CITA_ID, inicio, new Date("2026-10-12T10:00:00.000Z"))
        expect(r.map((x) => x.tipo)).toEqual(["1h"])
        expect(recordatoriosPorProgramar(CITA_ID, inicio, new Date("2026-10-12T14:30:00.000Z"))).toEqual([])
    })
})

describe("claveRecordatorio", () => {
    it("es estable para el mismo recordatorio y cambia si la cita se reprograma", () => {
        const a = claveRecordatorio({ citaId: CITA_ID, tipo: "24h", fechaInicio: inicio })
        expect(claveRecordatorio({ citaId: CITA_ID, tipo: "24h", fechaInicio: new Date(inicio) })).toBe(a)
        expect(claveRecordatorio({ citaId: CITA_ID, tipo: "1h", fechaInicio: inicio })).not.toBe(a)
        expect(claveRecordatorio({ citaId: CITA_ID, tipo: "24h", fechaInicio: new Date("2026-10-13T15:00:00.000Z") })).not.toBe(a)
    })
})

describe("motivoParaOmitir", () => {
    const cita: EstadoRecordatorioCita = {
        estado: "pendiente",
        fechaInicio: inicio,
        recordatorio24hEnviado: false,
        recordatorio1hEnviado: false,
        emailDestinatario: "ana@example.com",
    }
    const mensaje: MensajeRecordatorio = { citaId: CITA_ID, tipo: "24h", fechaInicio: new Date(inicio) }

    it("procede con una cita pendiente o confirmada en el horario programado", () => {
        expect(motivoParaOmitir(cita, mensaje)).toBeNull()
        expect(motivoParaOmitir({ ...cita, estado: "confirmada" }, mensaje)).toBeNull()
    })

    it.each(["cancelada", "completada", "no_show"] as const)("omite una cita %s", (estado) => {
        expect(motivoParaOmitir({ ...cita, estado }, mensaje)).toBe("CITA_INACTIVA")
    })

    it("omite el recordatorio viejo de una cita reprogramada", () => {
        const reprogramada = { ...cita, fechaInicio: new Date("2026-10-14T18:00:00.000Z") }
        expect(motivoParaOmitir(reprogramada, mensaje)).toBe("HORARIO_CAMBIADO")
    })

    it("no envía dos veces el mismo tipo", () => {
        expect(motivoParaOmitir({ ...cita, recordatorio24hEnviado: true }, mensaje)).toBe("YA_ENVIADO")
        expect(motivoParaOmitir({ ...cita, recordatorio24hEnviado: true }, { ...mensaje, tipo: "1h" })).toBeNull()
        expect(motivoParaOmitir({ ...cita, recordatorio1hEnviado: true }, { ...mensaje, tipo: "1h" })).toBe("YA_ENVIADO")
    })

    it("omite si no hay destinatario", () => {
        expect(motivoParaOmitir({ ...cita, emailDestinatario: null }, mensaje)).toBe("SIN_DESTINATARIO")
    })
})
