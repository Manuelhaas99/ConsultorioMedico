import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("./repositorio", () => ({ todasLasEspecialidades: vi.fn() }))

const repositorio = await import("./repositorio")
const { listarEspecialidades } = await import("./servicio")

beforeEach(() => {
    vi.resetAllMocks()
})

describe("listarEspecialidades", () => {
    it("devuelve solo los campos públicos", async () => {
        vi.mocked(repositorio.todasLasEspecialidades).mockResolvedValue([
            { id: "e1", nombre: "Ortodoncia", icono: "braces", creadoEn: new Date("2026-01-01T00:00:00Z") },
        ])

        expect(await listarEspecialidades()).toEqual([{ id: "e1", nombre: "Ortodoncia", icono: "braces" }])
    })
})
