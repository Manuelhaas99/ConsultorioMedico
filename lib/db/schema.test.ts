import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

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

// Si alguno desaparece del esquema, `drizzle-kit generate` lo borraría de la base en silencio.
describe("índices y restricciones", () => {
    const configDe = (nombre: string) => {
        const tabla = tablas.find((t) => getTableConfig(t).name === nombre)
        if (!tabla) throw new Error(`No existe la tabla ${nombre}`)
        return getTableConfig(tabla)
    }

    const columnasDeIndice = (nombre: string, indice: string) => {
        const idx = configDe(nombre).indexes.find((i) => i.config.name === indice)
        return idx?.config.columns.map((c) => ("name" in c ? c.name : "<expr>"))
    }

    it.each([
        ["cita", "cita_doctor_id_fecha_inicio_idx", ["doctor_id", "fecha_inicio"]],
        ["cita", "cita_paciente_id_idx", ["paciente_id"]],
        ["disponibilidad_doctor", "disponibilidad_doctor_doctor_id_idx", ["doctor_id"]],
        ["bloqueo_horario", "bloqueo_horario_doctor_id_idx", ["doctor_id"]],
        ["ubicacion", "ubicacion_doctor_id_idx", ["doctor_id"]],
        ["tipo_consulta", "tipo_consulta_doctor_id_idx", ["doctor_id"]],
        ["doctor", "doctor_usuario_id_idx", ["usuario_id"]],
        ["secretario", "secretario_doctor_id_idx", ["doctor_id"]],
    ])("%s tiene el índice %s", (tabla, indice, columnas) => {
        expect(columnasDeIndice(tabla, indice)).toEqual(columnas)
    })

    it.each([
        ["cita", "cita_fechas_validas"],
        ["cita", "cita_paciente_o_invitado"],
        ["bloqueo_horario", "bloqueo_horario_fechas_validas"],
        ["disponibilidad_doctor", "disponibilidad_doctor_horas_validas"],
        ["tipo_consulta", "tipo_consulta_duracion_positiva"],
    ])("%s tiene el CHECK %s", (tabla, nombre) => {
        expect(configDe(tabla).checks.map((c) => c.name)).toContain(nombre)
    })
})

/**
 * C6: todo instante se guarda como `timestamp with time zone`. Un `timestamp`
 * sin zona depende de la zona de quien escribe y lee (servidor, sesión de Postgres).
 */
describe("instantes con zona horaria", () => {
    const columnasTimestamp = tablas.flatMap((tabla) => {
        const { name, columns } = getTableConfig(tabla)
        return columns
            .filter((c) => c.getSQLType().startsWith("timestamp"))
            .map((c) => ({ tabla: name, columna: c.name, tipo: c.getSQLType() }))
    })

    it("hay columnas timestamp que revisar", () => {
        expect(columnasTimestamp.length).toBeGreaterThan(0)
    })

    it.each(columnasTimestamp)("$tabla.$columna es timestamp with time zone", ({ tipo }) => {
        expect(tipo).toBe("timestamp with time zone")
    })
})

/**
 * 0003 cambia fecha_inicio/fecha_fin a timestamptz. Si se alteran en sentencias
 * separadas, el CHECK `fecha_fin > fecha_inicio` se evalúa entre timestamptz y
 * timestamp (convertido con el TimeZone de la sesión) y la migración falla en
 * sesiones al este de UTC. Ambas columnas deben cambiar en la misma sentencia.
 */
describe("migración 0003 a timestamptz", () => {
    const sentencias = readFileSync(
        fileURLToPath(new URL("./migrations/0003_zona_horaria_timestamptz.sql", import.meta.url)),
        "utf8",
    ).split("--> statement-breakpoint")

    it.each(["cita", "bloqueo_horario"])(
        "%s altera fecha_inicio y fecha_fin en la misma sentencia",
        (tabla) => {
            const alteranInicio = sentencias.filter(
                (s) => s.includes(`ALTER TABLE "${tabla}"`) && s.includes(`ALTER COLUMN "fecha_inicio"`),
            )
            expect(alteranInicio).toHaveLength(1)
            expect(alteranInicio[0]).toContain(`ALTER COLUMN "fecha_fin"`)
        },
    )
})
