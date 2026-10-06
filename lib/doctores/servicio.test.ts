import { beforeEach, describe, expect, it, vi } from "vitest"
import { CODIGO_VIOLACION_UNICA, RESTRICCION_USUARIO_UNICO } from "./errores"
import type { FilaDoctor } from "./repositorio"

vi.mock("@/lib/auth/repositorio", () => ({ rolDeUsuario: vi.fn() }))
vi.mock("./repositorio", () => ({
    doctorDeUsuario: vi.fn(),
    doctorPorCedula: vi.fn(),
    insertarDoctor: vi.fn(),
    aprobarDoctorYAsignarRol: vi.fn(),
    doctoresAprobados: vi.fn(),
    relacionConDoctor: vi.fn(),
    filasPerfil: vi.fn(),
    disponibilidadDe: vi.fn(),
    bloqueosDe: vi.fn(),
}))

const { rolDeUsuario } = await import("@/lib/auth/repositorio")
const repositorio = await import("./repositorio")
const { aprobarDoctor, listarDoctores, obtenerBloqueos, obtenerDisponibilidad, obtenerPerfilDoctor, registrarDoctor } =
    await import("./servicio")

const fila: FilaDoctor = {
    id: "6f1c1b7e-0000-4000-8000-0000000000d1",
    usuarioId: "u1",
    especialidadId: "6f1c1b7e-0000-4000-8000-0000000000e1",
    cedula: "1234567",
    bio: null,
    aprobado: false,
    googleCalendarId: null,
    googleRefreshToken: null,
    creadoEn: new Date("2026-01-01T00:00:00Z"),
}

const entrada = { especialidadId: fila.especialidadId, cedula: fila.cedula, bio: null }

beforeEach(() => {
    vi.resetAllMocks()
})

describe("registrarDoctor", () => {
    it("crea la solicitud sin aprobar y sin cambiar el rol", async () => {
        vi.mocked(rolDeUsuario).mockResolvedValue("paciente")
        vi.mocked(repositorio.insertarDoctor).mockResolvedValue(fila)

        const r = await registrarDoctor(entrada, { usuarioId: "u1" })

        expect(r).toEqual({ ok: true, doctor: expect.objectContaining({ aprobado: false }) })
        expect(repositorio.insertarDoctor).toHaveBeenCalledWith({ usuarioId: "u1", ...entrada })
        expect(repositorio.aprobarDoctorYAsignarRol).not.toHaveBeenCalled()
    })

    it("rechaza un segundo perfil del mismo usuario", async () => {
        vi.mocked(rolDeUsuario).mockResolvedValue("paciente")
        vi.mocked(repositorio.doctorDeUsuario).mockResolvedValue({ id: fila.id })

        expect(await registrarDoctor(entrada, { usuarioId: "u1" })).toEqual({ ok: false, error: "PERFIL_DUPLICADO" })
        expect(repositorio.insertarDoctor).not.toHaveBeenCalled()
    })

    it("traduce la carrera perdida contra la restricción UNIQUE", async () => {
        vi.mocked(rolDeUsuario).mockResolvedValue("paciente")
        vi.mocked(repositorio.insertarDoctor).mockRejectedValue(
            new Error("Failed query", {
                cause: Object.assign(new Error("dup"), { code: CODIGO_VIOLACION_UNICA, constraint: RESTRICCION_USUARIO_UNICO }),
            }),
        )

        expect(await registrarDoctor(entrada, { usuarioId: "u1" })).toEqual({ ok: false, error: "PERFIL_DUPLICADO" })
    })

    it("rechaza a quien no es paciente", async () => {
        vi.mocked(rolDeUsuario).mockResolvedValue("secretario")
        expect(await registrarDoctor(entrada, { usuarioId: "u1" })).toEqual({ ok: false, error: "ROL_NO_PERMITIDO" })
    })
})

describe("aprobarDoctor", () => {
    it("solo un admin puede aprobar", async () => {
        vi.mocked(rolDeUsuario).mockResolvedValue("medico")
        expect(await aprobarDoctor(fila.id, { usuarioId: "u2" })).toEqual({ ok: false, error: "NO_AUTORIZADO" })
        expect(repositorio.aprobarDoctorYAsignarRol).not.toHaveBeenCalled()
    })

    it("aprueba y reporta el nuevo rol", async () => {
        vi.mocked(rolDeUsuario).mockResolvedValue("admin")
        vi.mocked(repositorio.aprobarDoctorYAsignarRol).mockResolvedValue({ doctor: { ...fila, aprobado: true }, rol: "medico" })

        const r = await aprobarDoctor(fila.id, { usuarioId: "admin1" })
        expect(r).toEqual({ ok: true, doctor: expect.objectContaining({ aprobado: true }), rolUsuario: "medico" })
    })

    it("404 si el doctor no existe", async () => {
        vi.mocked(rolDeUsuario).mockResolvedValue("admin")
        vi.mocked(repositorio.aprobarDoctorYAsignarRol).mockResolvedValue(undefined)
        expect(await aprobarDoctor(fila.id, { usuarioId: "admin1" })).toEqual({ ok: false, error: "NO_ENCONTRADO" })
    })
})

describe("listarDoctores", () => {
    it("pasa los filtros al repositorio y no expone correos", async () => {
        vi.mocked(repositorio.doctoresAprobados).mockResolvedValue([
            Object.assign(
                {
                    id: fila.id,
                    bio: null,
                    cedula: fila.cedula,
                    especialidadId: fila.especialidadId,
                    aprobado: true,
                    especialidadNombre: "Ortodoncia",
                    nombre: "Dra. Ruiz",
                    imagen: null,
                },
                { email: "dra@personal.mx" },
            ),
        ])

        const doctores = await listarDoctores({ especialidad: fila.especialidadId, ciudad: "Puebla" })

        expect(repositorio.doctoresAprobados).toHaveBeenCalledWith({ especialidadId: fila.especialidadId, ciudad: "Puebla" })
        expect(doctores[0]).not.toHaveProperty("email")
    })
})

describe("visibilidad de un doctor", () => {
    const sinRelacion = { esDueno: false, esSecretario: false }
    const filasPerfil = {
        doctor: {
            id: fila.id,
            bio: null,
            cedula: fila.cedula,
            especialidadId: fila.especialidadId,
            aprobado: false,
            especialidadNombre: "Ortodoncia",
            nombre: "Dra. Ruiz",
            imagen: null,
        },
        ubicaciones: [],
        disponibilidad: [],
        tiposConsulta: [],
    }

    it("un doctor sin aprobar es 404 para un anónimo", async () => {
        vi.mocked(repositorio.relacionConDoctor).mockResolvedValue({ aprobado: false, ...sinRelacion })

        expect(await obtenerPerfilDoctor(fila.id, null)).toEqual({ ok: false, error: "NO_ENCONTRADO" })
        expect(await obtenerDisponibilidad(fila.id, null)).toEqual({ ok: false, error: "NO_ENCONTRADO" })
        expect(await obtenerBloqueos(fila.id, null)).toEqual({ ok: false, error: "NO_ENCONTRADO" })
        expect(repositorio.filasPerfil).not.toHaveBeenCalled()
        expect(rolDeUsuario).not.toHaveBeenCalled()
    })

    it("un doctor sin aprobar es 404 para otro paciente", async () => {
        vi.mocked(repositorio.relacionConDoctor).mockResolvedValue({ aprobado: false, ...sinRelacion })
        vi.mocked(rolDeUsuario).mockResolvedValue("paciente")
        expect(await obtenerPerfilDoctor(fila.id, { usuarioId: "u9" })).toEqual({ ok: false, error: "NO_ENCONTRADO" })
    })

    it("el propio doctor y el admin ven su perfil sin aprobar", async () => {
        vi.mocked(repositorio.filasPerfil).mockResolvedValue(filasPerfil)

        vi.mocked(repositorio.relacionConDoctor).mockResolvedValue({ aprobado: false, esDueno: true, esSecretario: false })
        vi.mocked(rolDeUsuario).mockResolvedValue("paciente")
        expect(await obtenerPerfilDoctor(fila.id, { usuarioId: "u1" })).toMatchObject({ ok: true, data: { aprobado: false } })

        vi.mocked(repositorio.relacionConDoctor).mockResolvedValue({ aprobado: false, ...sinRelacion })
        vi.mocked(rolDeUsuario).mockResolvedValue("admin")
        expect(await obtenerPerfilDoctor(fila.id, { usuarioId: "admin1" })).toMatchObject({ ok: true })
    })

    it("el público solo ve bloqueos vigentes y sin motivo", async () => {
        const ahora = new Date("2026-10-10T00:00:00Z")
        vi.mocked(repositorio.relacionConDoctor).mockResolvedValue({ aprobado: true, ...sinRelacion })
        vi.mocked(repositorio.bloqueosDe).mockResolvedValue([
            {
                id: "b1",
                doctorId: fila.id,
                fechaInicio: new Date("2026-10-12T15:00:00Z"),
                fechaFin: new Date("2026-10-12T17:00:00Z"),
                motivo: "Cita médica personal",
                creadoEn: ahora,
            },
        ])

        const r = await obtenerBloqueos(fila.id, null, ahora)

        expect(repositorio.bloqueosDe).toHaveBeenCalledWith(fila.id, ahora)
        expect(r).toEqual({
            ok: true,
            data: [{ fechaInicio: new Date("2026-10-12T15:00:00Z"), fechaFin: new Date("2026-10-12T17:00:00Z") }],
        })
    })

    it("un secretario ve todos los bloqueos con motivo", async () => {
        vi.mocked(repositorio.relacionConDoctor).mockResolvedValue({ aprobado: true, esDueno: false, esSecretario: true })
        vi.mocked(rolDeUsuario).mockResolvedValue("secretario")
        vi.mocked(repositorio.bloqueosDe).mockResolvedValue([
            {
                id: "b1",
                doctorId: fila.id,
                fechaInicio: new Date("2026-10-12T15:00:00Z"),
                fechaFin: new Date("2026-10-12T17:00:00Z"),
                motivo: "Cita médica personal",
                creadoEn: new Date(),
            },
        ])

        const r = await obtenerBloqueos(fila.id, { usuarioId: "s1" })

        expect(repositorio.bloqueosDe).toHaveBeenCalledWith(fila.id, undefined)
        expect(r).toMatchObject({ ok: true, data: [{ motivo: "Cita médica personal" }] })
    })
})
