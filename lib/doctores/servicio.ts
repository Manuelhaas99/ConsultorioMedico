import "server-only"
import { rolDeUsuario } from "@/lib/auth/repositorio"
import { doctorPropio, type DoctorPropioDto } from "./dto"
import { conflictoDeDoctor, type ConflictoDoctor } from "./errores"
import { puedeAprobarDoctores, puedeSolicitarRegistro } from "./politica"
import { aprobarDoctorYAsignarRol, doctorDeUsuario, doctorPorCedula, insertarDoctor } from "./repositorio"
import type { RegistrarDoctorEntrada } from "./schemas"
import type { Rol } from "@/lib/auth/roles"

export type Actor = { usuarioId: string }

export type ErrorRegistrarDoctor = "ROL_NO_PERMITIDO" | ConflictoDoctor

export type ResultadoRegistrarDoctor = { ok: true; doctor: DoctorPropioDto } | { ok: false; error: ErrorRegistrarDoctor }

/**
 * El usuario conserva su rol hasta que un admin apruebe la solicitud. Las restricciones
 * UNIQUE garantizan un perfil por usuario y por cédula aun con peticiones simultáneas;
 * las consultas previas solo dan una respuesta más clara.
 */
export async function registrarDoctor(entrada: RegistrarDoctorEntrada, actor: Actor): Promise<ResultadoRegistrarDoctor> {
    const rol = await rolDeUsuario(actor.usuarioId)
    if (!puedeSolicitarRegistro(rol)) return { ok: false, error: "ROL_NO_PERMITIDO" }

    const [perfil, conCedula] = await Promise.all([doctorDeUsuario(actor.usuarioId), doctorPorCedula(entrada.cedula)])
    if (perfil) return { ok: false, error: "PERFIL_DUPLICADO" }
    if (conCedula) return { ok: false, error: "CEDULA_DUPLICADA" }

    try {
        const fila = await insertarDoctor({
            usuarioId: actor.usuarioId,
            especialidadId: entrada.especialidadId,
            cedula: entrada.cedula,
            bio: entrada.bio ?? null,
        })
        return { ok: true, doctor: doctorPropio(fila) }
    } catch (error) {
        const conflicto = conflictoDeDoctor(error)
        if (conflicto) return { ok: false, error: conflicto }
        throw error
    }
}

export type ErrorAprobarDoctor = "NO_AUTORIZADO" | "NO_ENCONTRADO"

export type ResultadoAprobarDoctor =
    | { ok: true; doctor: DoctorPropioDto; rolUsuario: Rol }
    | { ok: false; error: ErrorAprobarDoctor }

export async function aprobarDoctor(doctorId: string, actor: Actor): Promise<ResultadoAprobarDoctor> {
    const rol = await rolDeUsuario(actor.usuarioId)
    if (!puedeAprobarDoctores(rol)) return { ok: false, error: "NO_AUTORIZADO" }

    const resultado = await aprobarDoctorYAsignarRol(doctorId)
    if (!resultado) return { ok: false, error: "NO_ENCONTRADO" }
    return { ok: true, doctor: doctorPropio(resultado.doctor), rolUsuario: resultado.rol }
}
