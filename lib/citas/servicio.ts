import "server-only"
import { esTraslapeDeCitas } from "./errores"
import {
    actualizarCitaSiEstado,
    bloqueosQueTraslapan,
    citaPorId,
    citaPorTokenHash,
    citasQueTraslapan,
    esPersonalDelDoctor,
    doctorReservable,
    franjasDelDia,
    insertarCita,
    tipoConsultaDelDoctor,
    ubicacionDelDoctor,
    type CitaRegistrada,
    type NuevaCita,
} from "./repositorio"
import { chocaConCitas, type Intervalo } from "./intervalos"
import { chocaConBloqueos, dentroDeDisponibilidad, diaLocal, validarDuracion, validarIntervalo } from "./reglas"
import { puedeEditar, puedeVer, rolEnCita, type CambiosCita, type ErrorEdicion, type RolEnCita } from "./politica"
import type { CrearCitaEntrada, SlotsQuery } from "./schemas"
import { diaSemanaDeFecha, generarSlots, ventanaDeFranjas, type Slot } from "./slots"
import { generarTokenGestion, hashTokenGestion } from "./token"
import { ZONA_CONSULTORIO } from "./zona-horaria"

/**
 * Slots del doctor en una fecha (calendario del consultorio), marcando como no
 * disponibles los bloqueados u ocupados.
 */
export async function obtenerSlots(
    doctorId: string,
    { fecha, duracion }: SlotsQuery,
    zona: string = ZONA_CONSULTORIO,
): Promise<Slot[]> {
    const diaSemana = diaSemanaDeFecha(fecha)
    if (!diaSemana) return []

    const franjas = await franjasDelDia(doctorId, diaSemana)
    const ventana = ventanaDeFranjas(fecha, franjas, zona)
    if (!ventana) return []

    const [bloqueos, citas] = await Promise.all([
        bloqueosQueTraslapan(doctorId, ventana),
        citasQueTraslapan(doctorId, ventana),
    ])

    return generarSlots({ fecha, zona, duracionMinutos: duracion, franjas, bloqueos, citas })
}

/** Indica si el doctor tiene libre `intervalo`, es decir, sin citas activas que lo traslapen. */
export async function horarioLibre(doctorId: string, intervalo: Intervalo): Promise<boolean> {
    const citas = await citasQueTraslapan(doctorId, intervalo)
    return !chocaConCitas(intervalo, citas)
}

export type ResultadoReserva = { ok: true; cita: CitaRegistrada } | { ok: false; error: "HORARIO_OCUPADO" }

/**
 * Registra la cita si el horario está libre. La verificación previa da una
 * respuesta rápida, pero la garantía ante peticiones simultáneas es la
 * restricción de exclusión de la base: si otra reserva gana la carrera, la
 * inserción falla con 23P01 y se reporta como HORARIO_OCUPADO.
 */
export async function reservarCita(valores: NuevaCita): Promise<ResultadoReserva> {
    const libre = await horarioLibre(valores.doctorId, { inicio: valores.fechaInicio, fin: valores.fechaFin })
    if (!libre) return { ok: false, error: "HORARIO_OCUPADO" }

    try {
        return { ok: true, cita: await insertarCita(valores) }
    } catch (error) {
        if (esTraslapeDeCitas(error)) return { ok: false, error: "HORARIO_OCUPADO" }
        throw error
    }
}

/** Motivos de negocio por los que no se crea una cita. El handler los traduce a HTTP. */
export type ErrorCrearCita =
    | "RANGO_INVALIDO"
    | "FECHA_EN_PASADO"
    | "DURACION_INVALIDA"
    | "DOCTOR_NO_ENCONTRADO"
    | "DATOS_INVITADO_REQUERIDOS"
    | "UBICACION_INVALIDA"
    | "TIPO_CONSULTA_INVALIDO"
    | "FUERA_DE_DISPONIBILIDAD"
    | "HORARIO_BLOQUEADO"
    | "HORARIO_OCUPADO"

export type ResultadoCrearCita =
    | {
          ok: true
          cita: CitaRegistrada
          doctor: { nombre: string }
          contacto: Contacto
          /** Token en claro para el invitado (solo se conoce aquí; la base guarda su hash). `null` con sesión. */
          tokenGestion: string | null
      }
    | { ok: false; error: ErrorCrearCita }

/** A quién se notifica la cita (paciente con cuenta o invitado). */
export type Contacto = { nombre: string; email: string }

/** Quién reserva: un usuario con sesión o, si es `null`, un invitado. */
export type ContextoCrearCita = {
    usuario: { id: string; name: string; email: string } | null
    /** Reloj inyectable para pruebas. */
    ahora?: Date
    /** Zona del consultorio en la que se interpreta la disponibilidad. */
    zona?: string
}

/**
 * Crea una cita validando las reglas de negocio:
 * inicio futuro y anterior al fin; doctor aprobado; ubicación y tipo de consulta del
 * mismo doctor; duración igual a la del tipo (o entre los límites si no hay tipo);
 * intervalo completo dentro de la disponibilidad del doctor en la zona del consultorio;
 * sin traslapar bloqueos ni citas activas.
 */
export async function crearCita(
    entrada: CrearCitaEntrada,
    { usuario, ahora = new Date(), zona = ZONA_CONSULTORIO }: ContextoCrearCita,
): Promise<ResultadoCrearCita> {
    const intervalo: Intervalo = { inicio: entrada.fechaInicio, fin: entrada.fechaFin }
    const errorIntervalo = validarIntervalo(intervalo, ahora)
    if (errorIntervalo) return { ok: false, error: errorIntervalo }

    const doctor = await doctorReservable(entrada.doctorId)
    if (!doctor) return { ok: false, error: "DOCTOR_NO_ENCONTRADO" }

    const contacto = contactoDeReserva(entrada, usuario)
    if (!contacto) return { ok: false, error: "DATOS_INVITADO_REQUERIDOS" }

    const ubicacionId = entrada.ubicacionId ?? null
    const tipoConsultaId = entrada.tipoConsultaId ?? null
    const [ubicacionValida, tipo] = await Promise.all([
        ubicacionId ? ubicacionDelDoctor(ubicacionId, doctor.id) : Promise.resolve(true),
        tipoConsultaId ? tipoConsultaDelDoctor(tipoConsultaId, doctor.id) : Promise.resolve(null),
    ])
    if (!ubicacionValida) return { ok: false, error: "UBICACION_INVALIDA" }
    if (tipo === undefined) return { ok: false, error: "TIPO_CONSULTA_INVALIDO" }

    const errorDuracion = validarDuracion(intervalo, tipo)
    if (errorDuracion) return { ok: false, error: errorDuracion }

    const { diaSemana } = diaLocal(intervalo.inicio, zona)
    const franjas = diaSemana ? await franjasDelDia(doctor.id, diaSemana) : []
    if (!dentroDeDisponibilidad(intervalo, franjas, zona, ubicacionId)) {
        return { ok: false, error: "FUERA_DE_DISPONIBILIDAD" }
    }

    if (chocaConBloqueos(intervalo, await bloqueosQueTraslapan(doctor.id, intervalo))) {
        return { ok: false, error: "HORARIO_BLOQUEADO" }
    }

    // Solo los invitados necesitan token: quien tiene cuenta gestiona su cita con sesión.
    const token = usuario ? null : generarTokenGestion()
    const reserva = await reservarCita({
        doctorId: doctor.id,
        pacienteId: usuario?.id ?? null,
        ubicacionId,
        tipoConsultaId,
        invitadoNombre: usuario ? null : (entrada.invitadoNombre ?? null),
        invitadoEmail: usuario ? null : (entrada.invitadoEmail ?? null),
        invitadoTelefono: usuario ? null : (entrada.invitadoTelefono ?? null),
        fechaInicio: intervalo.inicio,
        fechaFin: intervalo.fin,
        estado: "pendiente",
        motivoConsulta: entrada.motivoConsulta ?? null,
        tokenGestionHash: token?.hash ?? null,
    })
    if (!reserva.ok) return reserva

    return {
        ok: true,
        cita: reserva.cita,
        doctor: { nombre: doctor.nombre },
        contacto,
        tokenGestion: token?.token ?? null,
    }
}

function contactoDeReserva(entrada: CrearCitaEntrada, usuario: ContextoCrearCita["usuario"]): Contacto | null {
    if (usuario) return { nombre: usuario.name, email: usuario.email }
    if (entrada.invitadoNombre && entrada.invitadoEmail) {
        return { nombre: entrada.invitadoNombre, email: entrada.invitadoEmail }
    }
    return null
}

/**
 * Cómo se llega a una cita: por id con sesión (paciente, doctor o secretario) o
 * con el token de gestión de un invitado, que identifica la cita por sí solo.
 */
export type AccesoCita = { citaId: string; usuarioId: string } | { token: string }

type CitaConRol = { cita: CitaRegistrada; rol: RolEnCita }

/**
 * Carga la cita y la relación de quien pide con ella. Devuelve `null` tanto si
 * no existe como si no tiene acceso, para no revelar qué identificadores existen.
 * El token se busca por su hash (índice único): nunca se compara en claro.
 */
async function citaConAcceso(acceso: AccesoCita): Promise<CitaConRol | null> {
    if ("token" in acceso) {
        const fila = await citaPorTokenHash(hashTokenGestion(acceso.token))
        if (!fila) return null
        const rol = rolEnCita(fila, { usuarioId: null, esPersonal: false, tokenValido: true })
        return puedeVer(rol) ? { cita: fila, rol } : null
    }
    const fila = await citaPorId(acceso.citaId)
    if (!fila) return null
    const esPersonal = await esPersonalDelDoctor(acceso.usuarioId, fila.doctorId)
    const rol = rolEnCita(fila, { usuarioId: acceso.usuarioId, esPersonal, tokenValido: false })
    return puedeVer(rol) ? { cita: fila, rol } : null
}

export type ResultadoObtenerCita = ({ ok: true } & CitaConRol) | { ok: false; error: "NO_ENCONTRADA" }

/** Cita visible para el paciente (sesión o token), el doctor dueño o sus secretarios. */
export async function obtenerCita(acceso: AccesoCita): Promise<ResultadoObtenerCita> {
    const resultado = await citaConAcceso(acceso)
    return resultado ? { ok: true, ...resultado } : { ok: false, error: "NO_ENCONTRADA" }
}

export type ErrorActualizarCita =
    | "NO_ENCONTRADA"
    | Exclude<ErrorEdicion, "NO_AUTORIZADO">
    /** La cita cambió de estado entre la lectura y la escritura. */
    | "CONFLICTO"

export type ResultadoActualizarCita = ({ ok: true } & CitaConRol) | { ok: false; error: ErrorActualizarCita }

/**
 * Aplica `cambios` si la política lo permite al rol de quien pide (ver `politica.ts`).
 * La escritura es condicional al estado leído para no pisar un cambio concurrente.
 */
export async function actualizarCita(
    acceso: AccesoCita,
    cambios: CambiosCita,
    ahora: Date = new Date(),
): Promise<ResultadoActualizarCita> {
    const actual = await citaConAcceso(acceso)
    if (!actual) return { ok: false, error: "NO_ENCONTRADA" }

    const error = puedeEditar(actual.rol, actual.cita, cambios, ahora)
    if (error === "NO_AUTORIZADO") return { ok: false, error: "NO_ENCONTRADA" }
    if (error) return { ok: false, error }

    const actualizada = await actualizarCitaSiEstado(actual.cita.id, actual.cita.estado, cambios)
    if (!actualizada) return { ok: false, error: "CONFLICTO" }
    return { ok: true, cita: actualizada, rol: actual.rol }
}

/** Cancela la cita con las mismas reglas que `actualizarCita(acceso, { estado: "cancelada" })`. */
export function cancelarCita(acceso: AccesoCita, ahora: Date = new Date()) {
    return actualizarCita(acceso, { estado: "cancelada" }, ahora)
}
