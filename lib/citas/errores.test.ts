import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { CODIGO_VIOLACION_EXCLUSION, esTraslapeDeCitas, RESTRICCION_SIN_TRASLAPE } from "./errores"
import { ESTADOS_QUE_LIBERAN_HORARIO } from "./intervalos"

const errorPg = (code: string, constraint?: string) => Object.assign(new Error("pg"), { code, constraint })

describe("esTraslapeDeCitas", () => {
    it("detecta la violación envuelta por Drizzle en `cause`", () => {
        const envuelto = new Error("Failed query", { cause: errorPg(CODIGO_VIOLACION_EXCLUSION, RESTRICCION_SIN_TRASLAPE) })
        expect(esTraslapeDeCitas(envuelto)).toBe(true)
    })

    it("detecta la violación directa del driver", () => {
        expect(esTraslapeDeCitas(errorPg(CODIGO_VIOLACION_EXCLUSION, RESTRICCION_SIN_TRASLAPE))).toBe(true)
    })

    it.each([
        ["otra restricción de exclusión", errorPg(CODIGO_VIOLACION_EXCLUSION, "otra")],
        ["violación de unique", errorPg("23505", RESTRICCION_SIN_TRASLAPE)],
        ["error sin código", new Error("x")],
        ["valor no error", "23P01"],
        ["null", null],
    ])("ignora %s", (_nombre, error) => {
        expect(esTraslapeDeCitas(error)).toBe(false)
    })

    it("no se cicla con causas circulares", () => {
        const a: { cause?: unknown } = {}
        a.cause = a
        expect(esTraslapeDeCitas(a)).toBe(false)
    })
})

describe("migración de la restricción de exclusión", () => {
    const sql = readFileSync(
        fileURLToPath(new URL("../db/migrations/0000_inicial.sql", import.meta.url)),
        "utf8",
    )

    it("crea la restricción con el nombre que traduce el servicio", () => {
        expect(sql).toContain(`ADD CONSTRAINT "${RESTRICCION_SIN_TRASLAPE}" EXCLUDE USING gist`)
    })

    it("usa intervalos semiabiertos con zona (tstzrange) como la lógica de la app", () => {
        expect(sql).toMatch(/tstzrange\("fecha_inicio", "fecha_fin", '\[\)'\) WITH &&/)
    })

    it("libera exactamente los mismos estados que ESTADOS_QUE_LIBERAN_HORARIO", () => {
        const where = sql.match(/WHERE \("estado" NOT IN \(([^)]*)\)\)/)
        expect(where).not.toBeNull()
        const estados = (where?.[1] ?? "").split(",").map((e) => e.trim().replace(/^'|'$/g, ""))
        expect(new Set(estados)).toEqual(new Set(ESTADOS_QUE_LIBERAN_HORARIO))
    })
})
