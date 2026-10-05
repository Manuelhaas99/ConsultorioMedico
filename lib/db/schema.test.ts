import { is } from "drizzle-orm"
import { getTableConfig, PgTable } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"

import * as schema from "./schema"

const exportados: readonly unknown[] = Object.values(schema)
const tablas = exportados.filter((valor): valor is PgTable => is(valor, PgTable))

// Postgres rechaza una llave foránea con tipos distintos ("incompatible types uuid and text")
// y, como la migración corre en una transacción, la base queda vacía.
describe("esquema de base de datos", () => {
    it("tiene tablas que revisar", () => {
        expect(tablas.length).toBeGreaterThan(0)
    })

    const casos = tablas.flatMap((tabla) => {
        const { name, foreignKeys } = getTableConfig(tabla)
        return foreignKeys.map((fk) => ({ tabla: name, llave: fk.getName(), fk }))
    })

    it.each(casos)("$tabla: $llave usa el mismo tipo que la columna referenciada", ({ fk }) => {
        const { columns, foreignColumns } = fk.reference()
        const tiposLocales = columns.map((columna) => columna.getSQLType())
        const tiposReferenciados = foreignColumns.map((columna) => columna.getSQLType())
        expect(tiposLocales).toEqual(tiposReferenciados)
    })
})
