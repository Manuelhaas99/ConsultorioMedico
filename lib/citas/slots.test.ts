import { describe, expect, it } from "vitest"
import { generarSlots, MAX_SLOTS, ventanaDeFranjas, type CitaAgendada, type Intervalo } from "./slots"

const fecha = "2026-10-12"

// Construye las horas igual que generarSlots, en la zona del proceso.
function hora(h: number, m = 0): Date {
    const d = new Date(fecha)
    d.setHours(h, m, 0, 0)
    return d
}

const manana = [{ horaInicio: "09:00:00", horaFin: "11:00:00" }]

describe("generarSlots", () => {
    it("parte la franja en slots consecutivos de la duración pedida", () => {
        const slots = generarSlots({ fecha, duracionMinutos: 30, franjas: manana, bloqueos: [], citas: [] })
        expect(slots.map((s) => s.inicio)).toEqual(
            [hora(9), hora(9, 30), hora(10), hora(10, 30)].map((d) => d.toISOString()),
        )
        expect(slots.every((s) => s.disponible)).toBe(true)
    })

    it("no genera un slot que se sale de la franja", () => {
        const slots = generarSlots({ fecha, duracionMinutos: 45, franjas: manana, bloqueos: [], citas: [] })
        expect(slots).toHaveLength(2)
        expect(slots.at(-1)?.fin).toBe(hora(10, 30).toISOString())
    })

    it("marca no disponible un slot que traslapa un bloqueo", () => {
        const bloqueos: Intervalo[] = [{ inicio: hora(9, 30), fin: hora(10) }]
        const slots = generarSlots({ fecha, duracionMinutos: 30, franjas: manana, bloqueos, citas: [] })
        expect(slots.map((s) => s.disponible)).toEqual([true, false, true, true])
    })

    it("un bloqueo de varios días bloquea toda la franja", () => {
        const bloqueos: Intervalo[] = [{ inicio: new Date("2026-10-10"), fin: new Date("2026-10-15") }]
        const slots = generarSlots({ fecha, duracionMinutos: 30, franjas: manana, bloqueos, citas: [] })
        expect(slots.every((s) => !s.disponible)).toBe(true)
    })

    it.each(["pendiente", "confirmada", "completada", "no_show"] as const)(
        "una cita %s ocupa su slot",
        (estado) => {
            const citas: CitaAgendada[] = [{ inicio: hora(9), fin: hora(9, 30), estado }]
            const slots = generarSlots({ fecha, duracionMinutos: 30, franjas: manana, bloqueos: [], citas })
            expect(slots.map((s) => s.disponible)).toEqual([false, true, true, true])
        },
    )

    it("una cita cancelada no ocupa su slot", () => {
        const citas: CitaAgendada[] = [{ inicio: hora(9), fin: hora(9, 30), estado: "cancelada" }]
        const slots = generarSlots({ fecha, duracionMinutos: 30, franjas: manana, bloqueos: [], citas })
        expect(slots.every((s) => s.disponible)).toBe(true)
    })

    it("una cita que solo traslapa parcialmente ocupa todos los slots que toca", () => {
        const citas: CitaAgendada[] = [{ inicio: hora(9, 15), fin: hora(10, 15), estado: "confirmada" }]
        const slots = generarSlots({ fecha, duracionMinutos: 30, franjas: manana, bloqueos: [], citas })
        expect(slots.map((s) => s.disponible)).toEqual([false, false, false, true])
    })

    it("una cita que empieza antes de la franja también ocupa el primer slot", () => {
        const citas: CitaAgendada[] = [{ inicio: hora(8, 30), fin: hora(9, 15), estado: "pendiente" }]
        const slots = generarSlots({ fecha, duracionMinutos: 30, franjas: manana, bloqueos: [], citas })
        expect(slots.map((s) => s.disponible)).toEqual([false, true, true, true])
    })

    it("citas contiguas al slot no lo ocupan", () => {
        const citas: CitaAgendada[] = [
            { inicio: hora(8, 30), fin: hora(9), estado: "confirmada" },
            { inicio: hora(9, 30), fin: hora(10), estado: "confirmada" },
        ]
        const slots = generarSlots({ fecha, duracionMinutos: 30, franjas: manana, bloqueos: [], citas })
        expect(slots.map((s) => s.disponible)).toEqual([true, false, true, true])
    })

    it.each([0, -30, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
        "rechaza la duración %s en lugar de entrar en un ciclo infinito",
        (duracionMinutos) => {
            expect(() => generarSlots({ fecha, duracionMinutos, franjas: manana, bloqueos: [], citas: [] })).toThrow(RangeError)
        },
    )

    it("respeta el tope de seguridad aunque las franjas produzcan más slots", () => {
        const dia = { horaInicio: "00:00:00", horaFin: "23:59:00" }
        const franjas = Array.from({ length: 10 }, () => dia)
        const slots = generarSlots({ fecha, duracionMinutos: 5, franjas, bloqueos: [], citas: [] })
        expect(slots).toHaveLength(MAX_SLOTS)
    })
})

describe("ventanaDeFranjas", () => {
    it("cubre desde el inicio más temprano hasta el fin más tardío", () => {
        const franjas = [
            { horaInicio: "16:00:00", horaFin: "19:00:00" },
            { horaInicio: "09:00:00", horaFin: "13:00:00" },
        ]
        expect(ventanaDeFranjas(fecha, franjas)).toEqual({ inicio: hora(9), fin: hora(19) })
    })

    it("devuelve null sin franjas", () => {
        expect(ventanaDeFranjas(fecha, [])).toBeNull()
    })
})
