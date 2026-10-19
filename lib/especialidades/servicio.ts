import "server-only"
import { especialidadPublica, type EspecialidadDto } from "./dto"
import { todasLasEspecialidades } from "./repositorio"

export async function listarEspecialidades(): Promise<EspecialidadDto[]> {
    return (await todasLasEspecialidades()).map(especialidadPublica)
}
