import { describe, expect, it } from "vitest"
import { puedeAprobarDoctores, puedeSolicitarRegistro, rolTrasAprobacion, vistaDeDoctor } from "./politica"

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

describe("vistaDeDoctor", () => {
    const nadie = { esDueno: false, esSecretario: false, esAdmin: false }

    it("un doctor aprobado es visible para cualquiera", () => {
        expect(vistaDeDoctor(true, nadie)).toBe("publica")
    })

    it("un doctor sin aprobar no es visible para el público", () => {
        expect(vistaDeDoctor(false, nadie)).toBeNull()
    })

    it("el propio doctor y sus secretarios lo ven como personal aunque no esté aprobado", () => {
        expect(vistaDeDoctor(false, { ...nadie, esDueno: true })).toBe("personal")
        expect(vistaDeDoctor(false, { ...nadie, esSecretario: true })).toBe("personal")
    })

    it("un admin ve doctores sin aprobar, pero no como personal", () => {
        expect(vistaDeDoctor(false, { ...nadie, esAdmin: true })).toBe("admin")
        expect(vistaDeDoctor(true, { ...nadie, esAdmin: true })).toBe("admin")
    })
})
