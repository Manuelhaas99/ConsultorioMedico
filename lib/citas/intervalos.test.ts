import { describe, expect, it } from "vitest"
import { ocupaHorario, seTraslapan } from "./intervalos"

const t = (hhmm: string) => new Date(`2026-10-12T${hhmm}:00.000Z`)
const i = (a: string, b: string) => ({ inicio: t(a), fin: t(b) })

describe("seTraslapan", () => {
    it.each([
        ["iguales", i("09:00", "09:30"), i("09:00", "09:30"), true],
        ["parcial al inicio", i("08:45", "09:15"), i("09:00", "09:30"), true],
        ["parcial al final", i("09:15", "09:45"), i("09:00", "09:30"), true],
        ["contenido", i("09:10", "09:20"), i("09:00", "09:30"), true],
        ["contiene", i("08:00", "10:00"), i("09:00", "09:30"), true],
        ["contiguo antes", i("08:30", "09:00"), i("09:00", "09:30"), false],
        ["contiguo después", i("09:30", "10:00"), i("09:00", "09:30"), false],
        ["separado", i("11:00", "11:30"), i("09:00", "09:30"), false],
    ])("%s", (_nombre, a, b, esperado) => {
        expect(seTraslapan(a, b)).toBe(esperado)
        expect(seTraslapan(b, a)).toBe(esperado)
    })
})

describe("ocupaHorario", () => {
    it("solo las canceladas liberan el horario", () => {
        expect(ocupaHorario("cancelada")).toBe(false)
        for (const estado of ["pendiente", "confirmada", "completada", "no_show"] as const) {
            expect(ocupaHorario(estado)).toBe(true)
        }
    })
})
