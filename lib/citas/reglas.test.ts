import { afterEach, describe, expect, it } from "vitest"
import {
    chocaConBloqueos,
    dentroDeDisponibilidad,
    diaLocal,
    validarDuracion,
    validarIntervalo,
    type FranjaConUbicacion,
} from "./reglas"

const zona = "America/Mexico_City"
/** Instante del lunes 2026-10-12 a las h:m en CDMX (UTC−6), construido en UTC. */
const cdmx = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 12, h + 6, m))
const i = (a: Date, b: Date) => ({ inicio: a, fin: b })
const franja = (horaInicio: string, horaFin: string, ubicacionId: string | null = null): FranjaConUbicacion => ({
    horaInicio,
    horaFin,
    ubicacionId,
})

const tzOriginal = process.env.TZ
afterEach(() => {
    process.env.TZ = tzOriginal
})

describe("validarIntervalo", () => {
    const ahora = cdmx(8)

    it("acepta un intervalo futuro y no vacío", () => {
        expect(validarIntervalo(i(cdmx(9), cdmx(9, 30)), ahora)).toBeNull()
    })

    it.each([
        ["fin antes de inicio", i(cdmx(10), cdmx(9))],
        ["fin igual a inicio", i(cdmx(9), cdmx(9))],
    ])("rechaza %s", (_n, intervalo) => {
        expect(validarIntervalo(intervalo, ahora)).toBe("RANGO_INVALIDO")
    })

    it.each([
        ["en el pasado", i(new Date("2020-01-01T15:00:00Z"), new Date("2020-01-01T15:30:00Z"))],
        ["que empieza justo ahora", i(ahora, cdmx(8, 30))],
    ])("rechaza una cita %s", (_n, intervalo) => {
        expect(validarIntervalo(intervalo, ahora)).toBe("FECHA_EN_PASADO")
    })
})

describe("validarDuracion", () => {
    it("con tipo de consulta exige exactamente su duración", () => {
        const tipo = { duracionMinutos: 45 }
        expect(validarDuracion(i(cdmx(9), cdmx(9, 45)), tipo)).toBeNull()
        expect(validarDuracion(i(cdmx(9), cdmx(9, 30)), tipo)).toBe("DURACION_INVALIDA")
        expect(validarDuracion(i(cdmx(9), cdmx(10)), tipo)).toBe("DURACION_INVALIDA")
    })

    it("sin tipo acepta minutos enteros entre 5 y 240", () => {
        expect(validarDuracion(i(cdmx(9), cdmx(9, 5)), null)).toBeNull()
        expect(validarDuracion(i(cdmx(9), cdmx(13)), null)).toBeNull()
    })

    it.each([
        ["8 horas", i(cdmx(9), cdmx(17))],
        ["1 minuto", i(cdmx(9), cdmx(9, 1))],
        ["fracción de minuto", i(cdmx(9), new Date(cdmx(9, 30).getTime() + 1000))],
    ])("sin tipo rechaza %s", (_n, intervalo) => {
        expect(validarDuracion(intervalo, null)).toBe("DURACION_INVALIDA")
    })
})

describe("diaLocal", () => {
    it.each(["UTC", "America/Mexico_City", "Asia/Tokyo"])("usa el calendario del consultorio con TZ=%s", (tz) => {
        process.env.TZ = tz
        // 22:00 del domingo 11 en CDMX ya es lunes 12 en UTC.
        expect(diaLocal(new Date("2026-10-12T04:00:00Z"), zona)).toEqual({ fecha: "2026-10-11", diaSemana: "domingo" })
        expect(diaLocal(cdmx(9), zona)).toEqual({ fecha: "2026-10-12", diaSemana: "lunes" })
    })
})

describe("dentroDeDisponibilidad", () => {
    const manana = [franja("09:00:00", "11:00:00")]

    it.each(["UTC", "America/Mexico_City", "Asia/Tokyo"])("acepta una cita dentro de la franja con TZ=%s", (tz) => {
        process.env.TZ = tz
        expect(dentroDeDisponibilidad(i(cdmx(9), cdmx(9, 30)), manana, zona, null)).toBe(true)
        expect(dentroDeDisponibilidad(i(cdmx(10, 30), cdmx(11)), manana, zona, null)).toBe(true)
    })

    it.each([
        ["antes de la franja (03:00, la hora UTC de la franja)", i(cdmx(3), cdmx(3, 30))],
        ["que empieza antes", i(cdmx(8, 45), cdmx(9, 15))],
        ["que termina después", i(cdmx(10, 45), cdmx(11, 15))],
        ["que cubre todo el día", i(cdmx(8), cdmx(16))],
    ])("rechaza una cita %s", (_n, intervalo) => {
        expect(dentroDeDisponibilidad(intervalo, manana, zona, null)).toBe(false)
    })

    it("rechaza cuando no hay franjas ese día", () => {
        expect(dentroDeDisponibilidad(i(cdmx(9), cdmx(9, 30)), [], zona, null)).toBe(false)
    })

    it("no deja reservar en el hueco entre dos franjas", () => {
        const franjas = [franja("09:00", "11:00"), franja("16:00", "19:00")]
        expect(dentroDeDisponibilidad(i(cdmx(10, 30), cdmx(11, 30)), franjas, zona, null)).toBe(false)
        expect(dentroDeDisponibilidad(i(cdmx(16), cdmx(17)), franjas, zona, null)).toBe(true)
    })

    it("une franjas contiguas", () => {
        const franjas = [franja("11:00", "13:00"), franja("09:00", "11:00")]
        expect(dentroDeDisponibilidad(i(cdmx(10, 30), cdmx(11, 30)), franjas, zona, null)).toBe(true)
    })

    it("una franja con ubicación solo cuenta para esa ubicación", () => {
        const franjas = [franja("09:00", "11:00", "ubic-a")]
        const cita = i(cdmx(9), cdmx(9, 30))
        expect(dentroDeDisponibilidad(cita, franjas, zona, "ubic-a")).toBe(true)
        expect(dentroDeDisponibilidad(cita, franjas, zona, "ubic-b")).toBe(false)
        expect(dentroDeDisponibilidad(cita, franjas, zona, null)).toBe(true)
        expect(dentroDeDisponibilidad(cita, [franja("09:00", "11:00")], zona, "ubic-b")).toBe(true)
    })
})

describe("chocaConBloqueos", () => {
    const bloqueos = [i(cdmx(10), cdmx(10, 30))]

    it("detecta una cita dentro o parcialmente dentro de un bloqueo", () => {
        expect(chocaConBloqueos(i(cdmx(10), cdmx(10, 30)), bloqueos)).toBe(true)
        expect(chocaConBloqueos(i(cdmx(9, 45), cdmx(10, 15)), bloqueos)).toBe(true)
    })

    it("una cita contigua al bloqueo no choca", () => {
        expect(chocaConBloqueos(i(cdmx(9, 30), cdmx(10)), bloqueos)).toBe(false)
        expect(chocaConBloqueos(i(cdmx(10, 30), cdmx(11)), bloqueos)).toBe(false)
    })
})
