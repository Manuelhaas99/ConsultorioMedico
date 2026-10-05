import { describe, expect, it } from "vitest"
import { puedeAprobarDoctores, puedeSolicitarRegistro, rolTrasAprobacion } from "./politica"

describe("puedeSolicitarRegistro", () => {
    it("solo permite a pacientes", () => {
        expect(puedeSolicitarRegistro("paciente")).toBe(true)
        expect(puedeSolicitarRegistro("medico")).toBe(false)
        expect(puedeSolicitarRegistro("secretario")).toBe(false)
        expect(puedeSolicitarRegistro("admin")).toBe(false)
        expect(puedeSolicitarRegistro(null)).toBe(false)
    })
})

describe("puedeAprobarDoctores", () => {
    it("solo permite a admins", () => {
        expect(puedeAprobarDoctores("admin")).toBe(true)
        expect(puedeAprobarDoctores("medico")).toBe(false)
        expect(puedeAprobarDoctores("paciente")).toBe(false)
        expect(puedeAprobarDoctores(null)).toBe(false)
    })
})

describe("rolTrasAprobacion", () => {
    it("un paciente pasa a medico", () => {
        expect(rolTrasAprobacion("paciente")).toBe("medico")
    })

    it("otros roles se conservan", () => {
        expect(rolTrasAprobacion("admin")).toBe("admin")
        expect(rolTrasAprobacion("medico")).toBe("medico")
        expect(rolTrasAprobacion("secretario")).toBe("secretario")
    })
})
