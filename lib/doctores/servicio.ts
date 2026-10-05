import "server-only"
import { rolDeUsuario } from "@/lib/auth/repositorio"
import {
    bloqueoParaVista,
    disponibilidadPublica,
    doctorPropio,
    doctorPublico,
    perfilDoctor,
    type BloqueoPersonalDto,
    type BloqueoPublicoDto,
    type DisponibilidadPublicaDto,
    type DoctorPropioDto,
    type DoctorPublicoDto,
    type PerfilDoctorDto,
} from "./dto"
import { conflictoDeDoctor, type ConflictoDoctor } from "./errores"
import { puedeAprobarDoctores, puedeSolicitarRegistro, vistaDeDoctor, type VistaDoctor } from "./politica"
import {
    aprobarDoctorYAsignarRol,
    bloqueosDe,
    disponibilidadDe,
    doctorDeUsuario,
    doctorPorCedula,
    doctoresAprobados,
    filasPerfil,
    insertarDoctor,
    relacionConDoctor,
} from "./repositorio"
import type { ListarDoctoresQuery, RegistrarDoctorEntrada } from "./schemas"
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

/** Directorio público: solo doctores aprobados, sin correos. */
export async function listarDoctores({ especialidad, ciudad }: ListarDoctoresQuery): Promise<DoctorPublicoDto[]> {
    const filas = await doctoresAprobados({ especialidadId: especialidad, ciudad })
    return filas.map(doctorPublico)
}

/**
 * Cómo ve `actor` (o un anónimo si es `null`) al doctor, o `null` si no debe
 * verlo: un doctor sin aprobar solo es visible para sí mismo, su personal y los admins.
 */
async function vistaPara(doctorId: string, actor: Actor | null): Promise<VistaDoctor | null> {
    const usuarioId = actor?.usuarioId ?? null
    const [relacion, rol] = await Promise.all([
        relacionConDoctor(doctorId, usuarioId),
        usuarioId ? rolDeUsuario(usuarioId) : Promise.resolve(null),
    ])
    if (!relacion) return null
    return vistaDeDoctor(relacion.aprobado, {
        esDueno: relacion.esDueno,
        esSecretario: relacion.esSecretario,
        esAdmin: rol === "admin",
    })
}

type Visible<T> = { ok: true; data: T } | { ok: false; error: "NO_ENCONTRADO" }

export async function obtenerPerfilDoctor(doctorId: string, actor: Actor | null): Promise<Visible<PerfilDoctorDto>> {
    const vista = await vistaPara(doctorId, actor)
    if (!vista) return { ok: false, error: "NO_ENCONTRADO" }
    const filas = await filasPerfil(doctorId)
    if (!filas) return { ok: false, error: "NO_ENCONTRADO" }
    return { ok: true, data: perfilDoctor(filas, vista) }
}

export async function obtenerDisponibilidad(
    doctorId: string,
    actor: Actor | null,
): Promise<Visible<DisponibilidadPublicaDto[]>> {
    const vista = await vistaPara(doctorId, actor)
    if (!vista) return { ok: false, error: "NO_ENCONTRADO" }
    return { ok: true, data: (await disponibilidadDe(doctorId)).map(disponibilidadPublica) }
}

/**
 * Bloqueos del doctor. El doctor y sus secretarios ven todos con su motivo;
 * los demás solo ven los intervalos que aún no terminan, sin motivo.
 */
export async function obtenerBloqueos(
    doctorId: string,
    actor: Actor | null,
    ahora: Date = new Date(),
): Promise<Visible<(BloqueoPublicoDto | BloqueoPersonalDto)[]>> {
    const vista = await vistaPara(doctorId, actor)
    if (!vista) return { ok: false, error: "NO_ENCONTRADO" }
    const filas = await bloqueosDe(doctorId, vista === "personal" ? undefined : ahora)
    return { ok: true, data: filas.map((b) => bloqueoParaVista(b, vista)) }
}
