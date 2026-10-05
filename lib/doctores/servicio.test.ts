import { beforeEach, describe, expect, it, vi } from "vitest"
import { CODIGO_VIOLACION_UNICA, RESTRICCION_USUARIO_UNICO } from "./errores"
import type { FilaDoctor } from "./repositorio"

vi.mock("@/lib/auth/repositorio", () => ({ rolDeUsuario: vi.fn() }))
vi.mock("./repositorio", () => ({
    doctorDeUsuario: vi.fn(),
    doctorPorCedula: vi.fn(),
    insertarDoctor: vi.fn(),
    aprobarDoctorYAsignarRol: vi.fn(),
}))

const { rolDeUsuario } = await import("@/lib/auth/repositorio")
const repositorio = await import("./repositorio")
const { aprobarDoctor, registrarDoctor } = await import("./servicio")

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
