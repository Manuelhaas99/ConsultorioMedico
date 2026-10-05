import "server-only"
import { and, eq, inArray } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { db } from "@/lib/db/client"
import { cita, doctor, especialidad, usuario } from "@/lib/db/schema"
import { ESTADOS_CON_RECORDATORIO, type EstadoRecordatorioCita } from "./reglas"
import type { TipoRecordatorio } from "./schemas"

const paciente = alias(usuario, "paciente")
const medico = alias(usuario, "medico")

export type DatosRecordatorio = EstadoRecordatorioCita & {
    id: string
    fechaFin: Date
    nombrePaciente: string
    nombreDoctor: string
    especialidad: string
    invitado: boolean
}

/** El destinatario es el correo de la cuenta del paciente o, si es invitado, el que dio al reservar. */
export async function datosParaRecordatorio(citaId: string): Promise<DatosRecordatorio | undefined> {
    const [fila] = await db
        .select({
            id: cita.id,
            estado: cita.estado,
            fechaInicio: cita.fechaInicio,
            fechaFin: cita.fechaFin,
            recordatorio24hEnviado: cita.recordatorio24hEnviado,
            recordatorio1hEnviado: cita.recordatorio1hEnviado,
            pacienteId: cita.pacienteId,
            pacienteNombre: paciente.name,
            pacienteEmail: paciente.email,
            invitadoNombre: cita.invitadoNombre,
            invitadoEmail: cita.invitadoEmail,
            nombreDoctor: medico.name,
            especialidad: especialidad.nombre,
        })
        .from(cita)
        .innerJoin(doctor, eq(cita.doctorId, doctor.id))
        .innerJoin(medico, eq(doctor.usuarioId, medico.id))
        .innerJoin(especialidad, eq(doctor.especialidadId, especialidad.id))
        .leftJoin(paciente, eq(cita.pacienteId, paciente.id))
        .where(eq(cita.id, citaId))
        .limit(1)
    if (!fila) return undefined

    const invitado = fila.pacienteId === null
    return {
        id: fila.id,
        estado: fila.estado,
        fechaInicio: fila.fechaInicio,
        fechaFin: fila.fechaFin,
        recordatorio24hEnviado: fila.recordatorio24hEnviado,
        recordatorio1hEnviado: fila.recordatorio1hEnviado,
        emailDestinatario: (invitado ? fila.invitadoEmail : fila.pacienteEmail) ?? null,
        nombrePaciente: (invitado ? fila.invitadoNombre : fila.pacienteNombre) ?? "Paciente",
        nombreDoctor: fila.nombreDoctor,
        especialidad: fila.especialidad,
        invitado,
    }
}

function columnaEnviado(tipo: TipoRecordatorio) {
    return tipo === "24h" ? cita.recordatorio24hEnviado : cita.recordatorio1hEnviado
}

function valorEnviado(tipo: TipoRecordatorio, enviado: boolean) {
    return tipo === "24h" ? { recordatorio24hEnviado: enviado } : { recordatorio1hEnviado: enviado }
}

/**
 * UPDATE condicional atómico: `true` solo si esta petición ganó el envío (no se
 * había enviado, la cita sigue activa y conserva el horario esperado).
 */
export async function reservarEnvio(citaId: string, tipo: TipoRecordatorio, fechaInicio: Date): Promise<boolean> {
    const filas = await db
        .update(cita)
        .set(valorEnviado(tipo, true))
        .where(
            and(
                eq(cita.id, citaId),
                eq(columnaEnviado(tipo), false),
                eq(cita.fechaInicio, fechaInicio),
                inArray(cita.estado, [...ESTADOS_CON_RECORDATORIO]),
            ),
        )
        .returning({ id: cita.id })
    return filas.length > 0
}

/** Permite que el reintento de QStash vuelva a enviarlo. */
export async function liberarEnvio(citaId: string, tipo: TipoRecordatorio): Promise<void> {
    await db.update(cita).set(valorEnviado(tipo, false)).where(eq(cita.id, citaId))
}
