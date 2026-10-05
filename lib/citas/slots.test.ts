import { describe, expect, it } from "vitest"
import { generarSlots, MAX_SLOTS, type Intervalo } from "./slots"

const fecha = "2026-10-12"

/** Misma construcción horaria que `generarSlots` (hora local del proceso). */
function hora(h: number, m = 0): Date {
    const d = new Date(fecha)
    d.setHours(h, m, 0, 0)
    return d
}

const manana = [{ horaInicio: "09:00:00", horaFin: "11:00:00" }]

describe("generarSlots", () => {
    it("parte la franja en slots consecutivos de la duración pedida", () => {
        const slots = generarSlots({ fecha, duracionMinutos: 30, franjas: manana, ocupados: [] })
        expect(slots.map((s) => s.inicio)).toEqual(
            [hora(9), hora(9, 30), hora(10), hora(10, 30)].map((d) => d.toISOString()),
        )
        expect(slots.every((s) => s.disponible)).toBe(true)
    })

    it("no genera un slot que se sale de la franja", () => {
        const slots = generarSlots({ fecha, duracionMinutos: 45, franjas: manana, ocupados: [] })
        expect(slots).toHaveLength(2)
        expect(slots.at(-1)?.fin).toBe(hora(10, 30).toISOString())
    })

    it("marca no disponible un slot que traslapa un intervalo ocupado", () => {
        const ocupados: Intervalo[] = [{ inicio: hora(9, 30), fin: hora(10) }]
        const slots = generarSlots({ fecha, duracionMinutos: 30, franjas: manana, ocupados })
        expect(slots.map((s) => s.disponible)).toEqual([true, false, true, true])
    })

    it.each([0, -30, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
        "rechaza la duración %s en lugar de entrar en un ciclo infinito",
        (duracionMinutos) => {
            expect(() => generarSlots({ fecha, duracionMinutos, franjas: manana, ocupados: [] })).toThrow(RangeError)
        },
    )

    it("respeta el tope de seguridad aunque las franjas produzcan más slots", () => {
        const dia = { horaInicio: "00:00:00", horaFin: "23:59:00" }
        const franjas = Array.from({ length: 10 }, () => dia)
        const slots = generarSlots({ fecha, duracionMinutos: 5, franjas, ocupados: [] })
        expect(slots).toHaveLength(MAX_SLOTS)
    })
})
