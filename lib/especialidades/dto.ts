import type { FilaEspecialidad } from "./repositorio"

export type EspecialidadDto = Pick<FilaEspecialidad, "id" | "nombre" | "icono">

export function especialidadPublica(e: FilaEspecialidad): EspecialidadDto {
    return { id: e.id, nombre: e.nombre, icono: e.icono }
}
