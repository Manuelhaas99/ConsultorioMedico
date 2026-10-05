import { afterEach, describe, expect, it } from "vitest"
import {
    aInstante,
    desplazamientoMs,
    diaSemanaDeFecha,
    fechaLocal,
    formatearIntervalo,
    ZONA_CONSULTORIO,
} from "./zona-horaria"

const CDMX = "America/Mexico_City"
const NY = "America/New_York"
const iso = (d: Date) => d.toISOString()

/** Zonas del proceso en las que el resultado debe ser idéntico (producción corre en UTC). */
const ZONAS_DEL_PROCESO = ["UTC", "America/Mexico_City", "Asia/Tokyo", "America/Los_Angeles"]
const tzOriginal = process.env.TZ

afterEach(() => {
    process.env.TZ = tzOriginal
})

describe("ZONA_CONSULTORIO", () => {
    it("es el centro de México por defecto", () => {
        expect(ZONA_CONSULTORIO).toBe(CDMX)
    })
})

describe("diaSemanaDeFecha", () => {
    it.each(ZONAS_DEL_PROCESO)("el 2026-10-12 es lunes con TZ=%s", (tz) => {
        process.env.TZ = tz
        expect(diaSemanaDeFecha("2026-10-12")).toBe("lunes")
        expect(diaSemanaDeFecha("2026-10-18")).toBe("domingo")
        expect(diaSemanaDeFecha("2028-02-29")).toBe("martes")
    })
})

describe("aInstante", () => {
    it.each(ZONAS_DEL_PROCESO)("09:00 en CDMX es 15:00Z sin importar TZ=%s", (tz) => {
        process.env.TZ = tz
        expect(iso(aInstante("2026-10-12", "09:00:00", CDMX))).toBe("2026-10-12T15:00:00.000Z")
        expect(iso(aInstante("2026-10-12", "09:30", CDMX))).toBe("2026-10-12T15:30:00.000Z")
    })

    it("interpreta 24:00 como la medianoche del día siguiente", () => {
        expect(iso(aInstante("2026-10-12", "24:00:00", CDMX))).toBe("2026-10-13T06:00:00.000Z")
    })

    it("usa el horario de verano cuando la zona lo tenía (CDMX en 2021)", () => {
        expect(iso(aInstante("2021-07-01", "09:00", CDMX))).toBe("2021-07-01T14:00:00.000Z")
        expect(iso(aInstante("2021-12-01", "09:00", CDMX))).toBe("2021-12-01T15:00:00.000Z")
    })

    it("recorre hacia adelante una hora inexistente (se adelanta el reloj)", () => {
        // 2026-03-08 en Nueva York: 02:00 EST salta a 03:00 EDT.
        expect(iso(aInstante("2026-03-08", "02:30", NY))).toBe("2026-03-08T07:30:00.000Z") // 03:30 EDT
        expect(iso(aInstante("2026-03-08", "03:00", NY))).toBe("2026-03-08T07:00:00.000Z")
    })

    it("elige la primera ocurrencia de una hora repetida (se atrasa el reloj)", () => {
        // 2026-11-01 en Nueva York: 02:00 EDT regresa a 01:00 EST.
        expect(iso(aInstante("2026-11-01", "01:30", NY))).toBe("2026-11-01T05:30:00.000Z") // 01:30 EDT
        expect(iso(aInstante("2026-11-01", "03:00", NY))).toBe("2026-11-01T08:00:00.000Z")
    })
})

describe("desplazamientoMs", () => {
    it("CDMX está a −6 h de UTC desde que abolió el horario de verano", () => {
        expect(desplazamientoMs(new Date("2026-07-01T12:00:00.123Z"), CDMX)).toBe(-6 * 3600_000)
    })
})

describe("fechaLocal", () => {
    it.each(ZONAS_DEL_PROCESO)("usa el calendario de la zona con TZ=%s", (tz) => {
        process.env.TZ = tz
        // 03:00Z del 13 todavía es 12 de octubre en CDMX.
        expect(fechaLocal(new Date("2026-10-13T03:00:00Z"), CDMX)).toBe("2026-10-12")
        expect(fechaLocal(new Date("2026-10-13T03:00:00Z"), "UTC")).toBe("2026-10-13")
    })
})

describe("formatearIntervalo", () => {
    it.each(ZONAS_DEL_PROCESO)("muestra la hora del consultorio con TZ=%s", (tz) => {
        process.env.TZ = tz
        const r = formatearIntervalo(new Date("2026-10-12T15:00:00Z"), new Date("2026-10-12T15:30:00Z"), CDMX)
        expect(r.fecha).toBe("lunes, 12 de octubre de 2026")
        expect(r.horaInicio).toBe("09:00")
        expect(r.horaFin).toBe("09:30")
    })
})
