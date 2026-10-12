import { describe, expect, it } from "vitest"
import { ROLES, tieneRol } from "./roles"

describe("ROLES", () => {
    it("coincide con el enum de la base (sin acentos)", () => {
        expect(ROLES).toEqual(["paciente", "medico", "secretario", "admin"])
    })
})

describe("tieneRol", () => {
    it("acepta el rol exacto del enum", () => {
        expect(tieneRol("medico", "medico")).toBe(true)
        expect(tieneRol("admin", ["medico", "admin"])).toBe(true)
    })

    it("rechaza otro rol", () => {
        expect(tieneRol("paciente", "medico")).toBe(false)
        expect(tieneRol("secretario", ["medico", "admin"])).toBe(false)
    })

    it("rechaza cuando no se conoce el rol", () => {
        expect(tieneRol(null, "admin")).toBe(false)
        expect(tieneRol(undefined, ["admin"])).toBe(false)
    })
})
