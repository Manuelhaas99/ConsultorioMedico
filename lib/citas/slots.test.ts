import { afterEach, describe, expect, it } from "vitest"
import {
    generarSlots as generarSlotsEnZona,
    MAX_SLOTS,
    ventanaDeFranjas,
    type CitaAgendada,
    type Intervalo,
    type ParametrosSlots,
} from "./slots"

const fecha = "2026-10-12" // lunes
const zona = "America/Mexico_City"

const generarSlots = (p: Omit<ParametrosSlots, "zona">) => generarSlotsEnZona({ zona, ...p })

// Ciudad de México es UTC−6 sin horario de verano desde 2022; se construye en UTC
// para no depender de la zona del proceso.
function hora(h: number, m = 0): Date {
    return new Date(Date.UTC(2026, 9, 12, h + 6, m))
}

const tzOriginal = process.env.TZ
afterEach(() => {
    process.env.TZ = tzOriginal
})

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
        expect(ventanaDeFranjas(fecha, franjas, zona)).toEqual({ inicio: hora(9), fin: hora(19) })
    })

    it("devuelve null sin franjas", () => {
        expect(ventanaDeFranjas(fecha, [], zona)).toBeNull()
    })
})

describe("zona horaria del consultorio", () => {
    it.each(["UTC", "America/Mexico_City", "Asia/Tokyo"])(
        "una agenda de 09:00 a 11:00 en CDMX se ofrece de 15:00Z a 17:00Z con TZ=%s",
        (tz) => {
            process.env.TZ = tz
            const slots = generarSlots({ fecha, duracionMinutos: 60, franjas: manana, bloqueos: [], citas: [] })
            expect(slots).toEqual([
                { inicio: "2026-10-12T15:00:00.000Z", fin: "2026-10-12T16:00:00.000Z", disponible: true },
                { inicio: "2026-10-12T16:00:00.000Z", fin: "2026-10-12T17:00:00.000Z", disponible: true },
            ])
        },
    )

    it("cuando se adelanta el reloj, la franja dura una hora menos en tiempo real", () => {
        // Nueva York, 2026-03-08: 02:00 EST → 03:00 EDT. De 01:00 a 04:00 hay 2 horas reales.
        const slots = generarSlotsEnZona({
            fecha: "2026-03-08",
            zona: "America/New_York",
            duracionMinutos: 60,
            franjas: [{ horaInicio: "01:00", horaFin: "04:00" }],
            bloqueos: [],
            citas: [],
        })
        expect(slots.map((s) => s.inicio)).toEqual(["2026-03-08T06:00:00.000Z", "2026-03-08T07:00:00.000Z"])
    })

    it("cuando se atrasa el reloj, la franja dura una hora más en tiempo real", () => {
        // Nueva York, 2026-11-01: 02:00 EDT → 01:00 EST. De 01:00 a 03:00 hay 3 horas reales.
        const slots = generarSlotsEnZona({
            fecha: "2026-11-01",
            zona: "America/New_York",
            duracionMinutos: 60,
            franjas: [{ horaInicio: "01:00", horaFin: "03:00" }],
            bloqueos: [],
            citas: [],
        })
        expect(slots.map((s) => s.inicio)).toEqual([
            "2026-11-01T05:00:00.000Z",
            "2026-11-01T06:00:00.000Z",
            "2026-11-01T07:00:00.000Z",
        ])
    })
})
