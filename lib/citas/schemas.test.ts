import { describe, expect, it } from "vitest"
import { doctorIdSchema, slotsQuerySchema } from "./schemas"

describe("slotsQuerySchema", () => {
    it("usa 30 minutos por defecto", () => {
        expect(slotsQuerySchema.parse({ fecha: "2026-10-12" })).toEqual({ fecha: "2026-10-12", duracion: 30 })
    })

    it("convierte la duración desde texto", () => {
        expect(slotsQuerySchema.parse({ fecha: "2026-10-12", duracion: "45" }).duracion).toBe(45)
    })

    it.each(["0", "-15", "4", "241", "100000", "15.5", "abc", ""])("rechaza duracion=%s", (duracion) => {
        expect(slotsQuerySchema.safeParse({ fecha: "2026-10-12", duracion }).success).toBe(false)
    })

    it.each([undefined, "", "abc", "2026-02-30", "2026-13-01", "2026-1-5", "12/10/2026", "2026-10-12T09:00"])(
        "rechaza fecha=%s",
        (fecha) => {
            expect(slotsQuerySchema.safeParse({ fecha }).success).toBe(false)
        },
    )

    it("acepta el 29 de febrero de un año bisiesto", () => {
        expect(slotsQuerySchema.safeParse({ fecha: "2028-02-29" }).success).toBe(true)
    })
})

describe("doctorIdSchema", () => {
    it("acepta un uuid y rechaza otros textos", () => {
        expect(doctorIdSchema.safeParse("6f1c1a52-3b8e-4f4e-9f3a-2d6c1b0e9a11").success).toBe(true)
        expect(doctorIdSchema.safeParse("123").success).toBe(false)
    })
})
