import { describe, expect, it } from "vitest"
import {
    CODIGO_VIOLACION_LLAVE_FORANEA,
    CODIGO_VIOLACION_UNICA,
    RESTRICCION_CEDULA_UNICA,
    RESTRICCION_ESPECIALIDAD,
    RESTRICCION_USUARIO_UNICO,
    conflictoDeDoctor,
} from "./errores"

const errorDrizzle = (code: string, constraint: string) =>
    new Error("Failed query", { cause: Object.assign(new Error("pg"), { code, constraint }) })

describe("conflictoDeDoctor", () => {
    it("detecta un segundo perfil del mismo usuario", () => {
        expect(conflictoDeDoctor(errorDrizzle(CODIGO_VIOLACION_UNICA, RESTRICCION_USUARIO_UNICO))).toBe("PERFIL_DUPLICADO")
    })

    it("detecta una cédula repetida", () => {
        expect(conflictoDeDoctor(errorDrizzle(CODIGO_VIOLACION_UNICA, RESTRICCION_CEDULA_UNICA))).toBe("CEDULA_DUPLICADA")
    })

    it("detecta una especialidad inexistente", () => {
        expect(conflictoDeDoctor(errorDrizzle(CODIGO_VIOLACION_LLAVE_FORANEA, RESTRICCION_ESPECIALIDAD))).toBe(
            "ESPECIALIDAD_INVALIDA",
        )
    })

    it("ignora otros errores", () => {
        expect(conflictoDeDoctor(errorDrizzle(CODIGO_VIOLACION_UNICA, "otra_restriccion"))).toBeNull()
        expect(conflictoDeDoctor(new Error("conexión perdida"))).toBeNull()
        expect(conflictoDeDoctor("texto")).toBeNull()
    })

    it("no se cicla con causas circulares", () => {
        const a: { cause?: unknown } = {}
        a.cause = a
        expect(conflictoDeDoctor(a)).toBeNull()
    })
})
