export type UbicacionCita = { nombre: string; direccion: string; colonia: string | null; ciudad: string }

export function formatearDireccion(ubicacion: UbicacionCita): string {
    return [ubicacion.nombre, ubicacion.direccion, ubicacion.colonia, ubicacion.ciudad]
        .map((parte) => parte?.trim())
        .filter((parte): parte is string => Boolean(parte))
        .join(", ")
}
