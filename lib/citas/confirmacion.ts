// Datos del correo de una cita recién creada (pura, sin I/O). Ver confirmacion.test.ts.

import type { EstadoConfirmacion } from "@/lib/email/templates"
import type { CitaRegistrada } from "./repositorio"
import { formatearDireccion, type UbicacionCita } from "./ubicacion"

export type CitaCreada = {
    cita: Pick<CitaRegistrada, "estado" | "fechaInicio" | "fechaFin">
    doctor: { nombre: string; especialidad: string }
    ubicacion: UbicacionCita | null
    contacto: { nombre: string; email: string }
    tokenGestion: string | null
}

export type DatosConfirmacion = {
    email: string
    estado: EstadoConfirmacion
    nombrePaciente: string
    nombreDoctor: string
    especialidad: string
    fechaInicio: Date
    fechaFin: Date
    direccion?: string
    tokenGestion?: string
}

function esEstadoConfirmacion(estado: CitaRegistrada["estado"]): estado is EstadoConfirmacion {
    return estado === "pendiente" || estado === "confirmada"
}

/**
 * Lo que dice el correo: la especialidad real del doctor, la dirección de la
 * ubicación si la reserva indica una y textos según el estado de la cita.
 * `null` si la cita ya no está activa (no hay nada que confirmar).
 */
export function datosConfirmacion({ cita, doctor, ubicacion, contacto, tokenGestion }: CitaCreada): DatosConfirmacion | null {
    if (!esEstadoConfirmacion(cita.estado)) return null
    return {
        email: contacto.email,
        estado: cita.estado,
        nombrePaciente: contacto.nombre,
        nombreDoctor: doctor.nombre,
        especialidad: doctor.especialidad,
        fechaInicio: cita.fechaInicio,
        fechaFin: cita.fechaFin,
        ...(ubicacion && { direccion: formatearDireccion(ubicacion) }),
        ...(tokenGestion && { tokenGestion }),
    }
}
