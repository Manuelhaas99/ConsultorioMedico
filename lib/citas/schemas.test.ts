import { describe, expect, it } from "vitest"
import { estadoCitaEnum } from "@/lib/db/schema"
import { actualizarCitaSchema, crearCitaSchema, doctorIdSchema, ESTADOS_CITA, slotsQuerySchema } from "./schemas"

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

describe("crearCitaSchema", () => {
    const valido = {
        doctorId: "6f1c1a52-3b8e-4f4e-9f3a-2d6c1b0e9a11",
        fechaInicio: "2026-10-12T09:00:00-06:00",
        fechaFin: "2026-10-12T09:30:00-06:00",
    }

    it("convierte las fechas con zona a instantes", () => {
        const r = crearCitaSchema.parse(valido)
        expect(r.fechaInicio.toISOString()).toBe("2026-10-12T15:00:00.000Z")
        expect(r.fechaFin.toISOString()).toBe("2026-10-12T15:30:00.000Z")
    })

    it("acepta fechas en UTC (Z)", () => {
        expect(crearCitaSchema.safeParse({ ...valido, fechaInicio: "2026-10-12T15:00:00Z", fechaFin: "2026-10-12T15:30:00.000Z" }).success).toBe(true)
    })

    it.each(["no-es-fecha", "2026-02-30T09:00:00Z", "2026-10-12", "2026-10-12T09:00:00", "", 1760281200000])(
        "rechaza fechaInicio=%s (inválida o sin zona) con 400 en lugar de 500",
        (fechaInicio) => {
            const r = crearCitaSchema.safeParse({ ...valido, fechaInicio })
            expect(r.success).toBe(false)
            if (!r.success) expect(r.error.issues[0]?.path).toEqual(["fechaInicio"])
        },
    )

    it("rechaza fin antes o igual que inicio", () => {
        const r = crearCitaSchema.safeParse({ ...valido, fechaFin: "2026-10-12T08:00:00-06:00" })
        expect(r.success).toBe(false)
        if (!r.success) expect(r.error.issues[0]?.path).toEqual(["fechaFin"])
        expect(crearCitaSchema.safeParse({ ...valido, fechaFin: valido.fechaInicio }).success).toBe(false)
    })

    it.each([
        ["doctorId", "123"],
        ["ubicacionId", "x"],
        ["tipoConsultaId", "x"],
        ["invitadoEmail", "no-es-correo"],
        ["invitadoNombre", "a".repeat(121)],
    ])("rechaza %s inválido", (campo, valor) => {
        expect(crearCitaSchema.safeParse({ ...valido, [campo]: valor }).success).toBe(false)
    })

    it("acepta null en ubicación y tipo de consulta y normaliza textos vacíos", () => {
        const r = crearCitaSchema.parse({ ...valido, ubicacionId: null, tipoConsultaId: null, invitadoNombre: "  ", motivoConsulta: " Limpieza " })
        expect(r.ubicacionId).toBeNull()
        expect(r.invitadoNombre).toBeUndefined()
        expect(r.motivoConsulta).toBe("Limpieza")
    })
})

describe("actualizarCitaSchema", () => {
    it("los estados coinciden con el enum de la base", () => {
        expect([...ESTADOS_CITA]).toEqual(estadoCitaEnum.enumValues)
    })

    it("acepta estado, motivo y notas; '' o null borran el texto", () => {
        expect(actualizarCitaSchema.parse({ estado: "cancelada", motivoConsulta: "  Dolor  ", notas: "" })).toEqual({
            estado: "cancelada",
            motivoConsulta: "Dolor",
            notas: null,
        })
        expect(actualizarCitaSchema.parse({ motivoConsulta: null })).toEqual({ motivoConsulta: null })
    })

    it.each([{ estado: "inventado" }, { estado: 1 }, {}, { pacienteId: "x" }, { estado: "cancelada", fechaInicio: "2026-01-01" }, { notas: "x".repeat(5001) }])(
        "rechaza %j",
        (cuerpo) => {
            expect(actualizarCitaSchema.safeParse(cuerpo).success).toBe(false)
        },
    )
})
