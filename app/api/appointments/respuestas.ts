import type { ErrorActualizarCita } from "@/lib/citas/servicio"

export const RESPUESTAS_ERROR_ACTUALIZAR = {
    NO_ENCONTRADA: [404, "Cita no encontrada"],
    CAMBIO_NO_PERMITIDO: [403, "No tienes permiso para hacer ese cambio en la cita"],
    CITA_NO_EDITABLE: [409, "La cita ya no se puede modificar"],
    TRANSICION_INVALIDA: [409, "La cita no puede pasar a ese estado desde su estado actual"],
    CONFLICTO: [409, "La cita cambió mientras se procesaba la solicitud; vuelve a intentarlo"],
} as const satisfies Record<ErrorActualizarCita, readonly [number, string]>
