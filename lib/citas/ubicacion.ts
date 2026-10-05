// Formato de la ubicación de una cita para mostrarla (pura, sin I/O). Ver ubicacion.test.ts.

export type UbicacionCita = { nombre: string; direccion: string; colonia: string | null; ciudad: string }

/** "Consultorio Centro, Av. Juárez 10, Centro, CDMX" — omite las partes vacías. */
export function formatearDireccion(ubicacion: UbicacionCita): string {
    return [ubicacion.nombre, ubicacion.direccion, ubicacion.colonia, ubicacion.ciudad]
        .map((parte) => parte?.trim())
        .filter((parte): parte is string => Boolean(parte))
        .join(", ")
}
