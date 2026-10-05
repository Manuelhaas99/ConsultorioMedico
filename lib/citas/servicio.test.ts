import { beforeEach, describe, expect, it, vi } from "vitest"
import { CODIGO_VIOLACION_EXCLUSION, RESTRICCION_SIN_TRASLAPE } from "./errores"
import type { CitaRegistrada, NuevaCita } from "./repositorio"
import type { CrearCitaEntrada } from "./schemas"

vi.mock("./repositorio", () => ({
    citasQueTraslapan: vi.fn(),
    insertarCita: vi.fn(),
    bloqueosQueTraslapan: vi.fn(),
    franjasDelDia: vi.fn(),
    doctorReservable: vi.fn(),
    ubicacionDelDoctor: vi.fn(),
    tipoConsultaDelDoctor: vi.fn(),
    citaPorId: vi.fn(),
    esPersonalDelDoctor: vi.fn(),
    actualizarCitaSiEstado: vi.fn(),
}))

const repositorio = await import("./repositorio")
const { actualizarCita, cancelarCita, crearCita, obtenerCita, reservarCita } = await import("./servicio")

const valores: NuevaCita = {
    doctorId: "6f1c1b7e-0000-4000-8000-000000000001",
    fechaInicio: new Date("2026-10-12T15:00:00.000Z"),
    fechaFin: new Date("2026-10-12T15:30:00.000Z"),
    invitadoNombre: "Ana",
    invitadoEmail: "ana@example.com",
}

const violacionDeExclusion = () =>
    new Error("Failed query", {
        cause: Object.assign(new Error("conflicting key value"), {
            code: CODIGO_VIOLACION_EXCLUSION,
            constraint: RESTRICCION_SIN_TRASLAPE,
        }),
    })

describe("reservarCita", () => {
    beforeEach(() => {
        vi.mocked(repositorio.citasQueTraslapan).mockReset().mockResolvedValue([])
        vi.mocked(repositorio.insertarCita).mockReset()
    })

    it("registra la cita cuando el horario está libre", async () => {
        const fila = { id: "c1" } as CitaRegistrada
        vi.mocked(repositorio.insertarCita).mockResolvedValue(fila)
        await expect(reservarCita(valores)).resolves.toEqual({ ok: true, cita: fila })
    })

    it("no inserta si la verificación previa encuentra una cita activa", async () => {
        vi.mocked(repositorio.citasQueTraslapan).mockResolvedValue([
            { inicio: valores.fechaInicio, fin: valores.fechaFin, estado: "confirmada" },
        ])
        await expect(reservarCita(valores)).resolves.toEqual({ ok: false, error: "HORARIO_OCUPADO" })
        expect(repositorio.insertarCita).not.toHaveBeenCalled()
    })

    it("traduce la violación de exclusión (carrera entre reservas) a HORARIO_OCUPADO", async () => {
        vi.mocked(repositorio.insertarCita).mockRejectedValue(violacionDeExclusion())
        await expect(reservarCita(valores)).resolves.toEqual({ ok: false, error: "HORARIO_OCUPADO" })
    })

    it("propaga cualquier otro error de la base", async () => {
        const error = new Error("conexión perdida")
        vi.mocked(repositorio.insertarCita).mockRejectedValue(error)
        await expect(reservarCita(valores)).rejects.toBe(error)
    })
})

describe("crearCita", () => {
    const doctorId = "6f1c1b7e-0000-4000-8000-000000000001"
    const ubicacionId = "6f1c1b7e-0000-4000-8000-0000000000a1"
    const tipoConsultaId = "6f1c1b7e-0000-4000-8000-0000000000b1"
    /** Lunes 2026-10-12 a las h:m en Ciudad de México (UTC−6). */
    const cdmx = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 12, h + 6, m))
    const ahora = new Date("2026-10-12T00:00:00Z") // domingo 11 a las 18:00 en CDMX
    const usuario = { id: "u1", name: "Ana", email: "ana@example.com" }
    const contexto = { usuario, ahora, zona: "America/Mexico_City" }
    const entrada: CrearCitaEntrada = { doctorId, fechaInicio: cdmx(9), fechaFin: cdmx(9, 30) }
    const fila = { id: "c1" } as CitaRegistrada

    beforeEach(() => {
        vi.mocked(repositorio.doctorReservable).mockReset().mockResolvedValue({ id: doctorId, nombre: "Dra. López" })
        vi.mocked(repositorio.ubicacionDelDoctor).mockReset().mockResolvedValue(true)
        vi.mocked(repositorio.tipoConsultaDelDoctor).mockReset().mockResolvedValue({ duracionMinutos: 30 })
        vi.mocked(repositorio.franjasDelDia)
            .mockReset()
            .mockResolvedValue([{ horaInicio: "09:00:00", horaFin: "11:00:00", ubicacionId: null }])
        vi.mocked(repositorio.bloqueosQueTraslapan).mockReset().mockResolvedValue([])
        vi.mocked(repositorio.citasQueTraslapan).mockReset().mockResolvedValue([])
        vi.mocked(repositorio.insertarCita).mockReset().mockResolvedValue(fila)
    })

    it("crea la cita del usuario con sesión dentro de la disponibilidad", async () => {
        await expect(crearCita(entrada, contexto)).resolves.toEqual({
            ok: true,
            cita: fila,
            doctor: { nombre: "Dra. López" },
            contacto: { nombre: "Ana", email: "ana@example.com" },
        })
        expect(repositorio.franjasDelDia).toHaveBeenCalledWith(doctorId, "lunes")
        expect(repositorio.insertarCita).toHaveBeenCalledWith(
            expect.objectContaining({
                doctorId,
                pacienteId: "u1",
                invitadoEmail: null,
                fechaInicio: cdmx(9),
                fechaFin: cdmx(9, 30),
                estado: "pendiente",
                tokenGestion: expect.stringMatching(/^[0-9a-f]{64}$/),
            }),
        )
    })

    it("crea la cita de un invitado con sus datos de contacto", async () => {
        const r = await crearCita(
            { ...entrada, invitadoNombre: "Luis", invitadoEmail: "luis@example.com" },
            { ...contexto, usuario: null },
        )
        expect(r).toMatchObject({ ok: true, contacto: { nombre: "Luis", email: "luis@example.com" } })
        expect(repositorio.insertarCita).toHaveBeenCalledWith(
            expect.objectContaining({ pacienteId: null, invitadoNombre: "Luis", invitadoEmail: "luis@example.com" }),
        )
    })

    type Caso = [nombre: string, preparar: () => void, entrada: CrearCitaEntrada, error: string]
    const casos: Caso[] = [
        ["fin antes de inicio", () => {}, { ...entrada, fechaFin: cdmx(8) }, "RANGO_INVALIDO"],
        [
            "una cita en 2020",
            () => {},
            { ...entrada, fechaInicio: new Date("2020-01-06T15:00:00Z"), fechaFin: new Date("2020-01-06T15:30:00Z") },
            "FECHA_EN_PASADO",
        ],
        ["doctor inexistente o no aprobado", () => vi.mocked(repositorio.doctorReservable).mockResolvedValue(undefined), entrada, "DOCTOR_NO_ENCONTRADO"],
        ["ubicación de otro doctor", () => vi.mocked(repositorio.ubicacionDelDoctor).mockResolvedValue(false), { ...entrada, ubicacionId }, "UBICACION_INVALIDA"],
        [
            "tipo de consulta de otro doctor",
            () => vi.mocked(repositorio.tipoConsultaDelDoctor).mockResolvedValue(undefined),
            { ...entrada, tipoConsultaId },
            "TIPO_CONSULTA_INVALIDO",
        ],
        [
            "duración distinta a la del tipo de consulta",
            () => vi.mocked(repositorio.tipoConsultaDelDoctor).mockResolvedValue({ duracionMinutos: 45 }),
            { ...entrada, tipoConsultaId },
            "DURACION_INVALIDA",
        ],
        ["una cita de 8 horas sin tipo", () => {}, { ...entrada, fechaFin: cdmx(17) }, "DURACION_INVALIDA"],
        [
            "un domingo a las 03:00, sin disponibilidad",
            () => vi.mocked(repositorio.franjasDelDia).mockResolvedValue([]),
            { ...entrada, fechaInicio: new Date("2026-10-18T09:00:00Z"), fechaFin: new Date("2026-10-18T09:30:00Z") },
            "FUERA_DE_DISPONIBILIDAD",
        ],
        [
            "a las 09:00 UTC (03:00 en CDMX), fuera de la franja",
            () => {},
            { ...entrada, fechaInicio: new Date("2026-10-12T09:00:00Z"), fechaFin: new Date("2026-10-12T09:30:00Z") },
            "FUERA_DE_DISPONIBILIDAD",
        ],
        [
            "que termina después de la franja",
            () => {},
            { ...entrada, fechaInicio: cdmx(10, 45), fechaFin: cdmx(11, 15) },
            "FUERA_DE_DISPONIBILIDAD",
        ],
        [
            "dentro de un bloqueo",
            () => vi.mocked(repositorio.bloqueosQueTraslapan).mockResolvedValue([{ inicio: cdmx(9), fin: cdmx(10) }]),
            entrada,
            "HORARIO_BLOQUEADO",
        ],
        [
            "en un horario ocupado",
            () =>
                vi.mocked(repositorio.citasQueTraslapan).mockResolvedValue([
                    { inicio: cdmx(9), fin: cdmx(9, 30), estado: "confirmada" },
                ]),
            entrada,
            "HORARIO_OCUPADO",
        ],
    ]

    it.each(casos)("rechaza %s", async (_nombre, preparar, datos, error) => {
        preparar()
        await expect(crearCita(datos, contexto)).resolves.toEqual({ ok: false, error })
        expect(repositorio.insertarCita).not.toHaveBeenCalled()
    })

    it("exige nombre y correo a un invitado", async () => {
        await expect(crearCita({ ...entrada, invitadoNombre: "Luis" }, { ...contexto, usuario: null })).resolves.toEqual({
            ok: false,
            error: "DATOS_INVITADO_REQUERIDOS",
        })
    })

    it("consulta la disponibilidad del día local del consultorio, no del día UTC", async () => {
        // Domingo 11 a las 21:00 en CDMX = lunes 12 a las 03:00 UTC.
        const domingo = { ...entrada, fechaInicio: new Date("2026-10-12T03:00:00Z"), fechaFin: new Date("2026-10-12T03:30:00Z") }
        vi.mocked(repositorio.franjasDelDia).mockResolvedValue([])
        await crearCita(domingo, { ...contexto, ahora: new Date("2026-10-11T12:00:00Z") })
        expect(repositorio.franjasDelDia).toHaveBeenCalledWith(doctorId, "domingo")
    })

    it("acepta la duración exacta del tipo de consulta en una ubicación del doctor", async () => {
        vi.mocked(repositorio.franjasDelDia).mockResolvedValue([{ horaInicio: "09:00", horaFin: "11:00", ubicacionId }])
        const r = await crearCita({ ...entrada, ubicacionId, tipoConsultaId }, contexto)
        expect(r.ok).toBe(true)
        expect(repositorio.ubicacionDelDoctor).toHaveBeenCalledWith(ubicacionId, doctorId)
        expect(repositorio.tipoConsultaDelDoctor).toHaveBeenCalledWith(tipoConsultaId, doctorId)
    })
})

describe("obtenerCita / actualizarCita / cancelarCita (C8)", () => {
    const ahora = new Date("2026-10-10T12:00:00Z")
    const existente = {
        id: "c1",
        doctorId: "d1",
        pacienteId: "pac",
        estado: "pendiente",
        fechaInicio: new Date("2026-10-12T15:00:00Z"),
        tokenGestion: "t".repeat(64),
    } as CitaRegistrada
    const paciente = { usuarioId: "pac", token: null }
    const doctor = { usuarioId: "doc", token: null }

    beforeEach(() => {
        vi.mocked(repositorio.citaPorId).mockReset().mockResolvedValue(existente)
        vi.mocked(repositorio.esPersonalDelDoctor)
            .mockReset()
            .mockImplementation(async (usuarioId, doctorId) => usuarioId === "doc" && doctorId === "d1")
        vi.mocked(repositorio.actualizarCitaSiEstado)
            .mockReset()
            .mockImplementation(async (_id, _estado, cambios) => ({ ...existente, ...cambios }) as CitaRegistrada)
    })

    it("el doctor dueño puede ver la cita por id", async () => {
        await expect(obtenerCita("c1", doctor)).resolves.toMatchObject({ ok: true, rol: "personal" })
    })

    it("otro usuario recibe NO_ENCONTRADA (no se revela que la cita existe)", async () => {
        await expect(obtenerCita("c1", { usuarioId: "otro", token: null })).resolves.toEqual({ ok: false, error: "NO_ENCONTRADA" })
    })

    it("un token incorrecto no da acceso", async () => {
        await expect(obtenerCita("c1", { usuarioId: null, token: "x" })).resolves.toEqual({ ok: false, error: "NO_ENCONTRADA" })
    })

    it("el paciente no puede confirmar su cita ni escribir notas", async () => {
        await expect(actualizarCita("c1", { estado: "confirmada" }, paciente, ahora)).resolves.toEqual({
            ok: false,
            error: "CAMBIO_NO_PERMITIDO",
        })
        await expect(actualizarCita("c1", { notas: "x" }, { usuarioId: null, token: "t".repeat(64) }, ahora)).resolves.toEqual({
            ok: false,
            error: "CAMBIO_NO_PERMITIDO",
        })
        expect(repositorio.actualizarCitaSiEstado).not.toHaveBeenCalled()
    })

    it("el paciente puede editar el motivo; la escritura es condicional al estado leído", async () => {
        const r = await actualizarCita("c1", { motivoConsulta: "Limpieza" }, paciente, ahora)
        expect(r).toMatchObject({ ok: true, rol: "paciente", cita: { motivoConsulta: "Limpieza" } })
        expect(repositorio.actualizarCitaSiEstado).toHaveBeenCalledWith("c1", "pendiente", { motivoConsulta: "Limpieza" })
    })

    it("el personal confirma una cita pendiente", async () => {
        await expect(actualizarCita("c1", { estado: "confirmada" }, doctor, ahora)).resolves.toMatchObject({
            ok: true,
            cita: { estado: "confirmada" },
        })
    })

    it("el personal no puede completar una cita pendiente", async () => {
        await expect(actualizarCita("c1", { estado: "completada" }, doctor, ahora)).resolves.toEqual({
            ok: false,
            error: "TRANSICION_INVALIDA",
        })
    })

    it("reporta CONFLICTO si el estado cambió entre la lectura y la escritura", async () => {
        vi.mocked(repositorio.actualizarCitaSiEstado).mockResolvedValue(undefined)
        await expect(cancelarCita("c1", paciente, ahora)).resolves.toEqual({ ok: false, error: "CONFLICTO" })
    })

    it("cancelar una cita ya cancelada no es posible para el paciente", async () => {
        vi.mocked(repositorio.citaPorId).mockResolvedValue({ ...existente, estado: "cancelada" })
        await expect(cancelarCita("c1", paciente, ahora)).resolves.toEqual({ ok: false, error: "CITA_NO_EDITABLE" })
    })
})
