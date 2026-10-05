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
import type { UbicacionCita } from "./ubicacion"
import { ZONA_CONSULTORIO } from "./zona-horaria"

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

export async function horarioLibre(doctorId: string, intervalo: Intervalo): Promise<boolean> {
    const citas = await citasQueTraslapan(doctorId, intervalo)
    return !chocaConCitas(intervalo, citas)
}

export type ResultadoReserva = { ok: true; cita: CitaRegistrada } | { ok: false; error: "HORARIO_OCUPADO" }

// La verificación previa solo responde rápido; ante reservas simultáneas la garantía
// es la restricción de exclusión, cuya violación también se reporta como HORARIO_OCUPADO.
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
          doctor: { nombre: string; especialidad: string }
          /** Ubicación elegida, o `null` si la reserva no indica una. */
          ubicacion: UbicacionCita | null
          contacto: Contacto
          /** Solo se conoce aquí: la base guarda su hash. `null` con sesión. */
          tokenGestion: string | null
      }
    | { ok: false; error: ErrorCrearCita }

/** A quién se notifica la cita. */
export type Contacto = { nombre: string; email: string }

export type ContextoCrearCita = {
    /** `null`: reserva como invitado. */
    usuario: { id: string; name: string; email: string } | null
    ahora?: Date
    zona?: string
}

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
    const [ubicacion, tipo] = await Promise.all([
        ubicacionId ? ubicacionDelDoctor(ubicacionId, doctor.id) : Promise.resolve(null),
        tipoConsultaId ? tipoConsultaDelDoctor(tipoConsultaId, doctor.id) : Promise.resolve(null),
    ])
    if (ubicacion === undefined) return { ok: false, error: "UBICACION_INVALIDA" }
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
        doctor: { nombre: doctor.nombre, especialidad: doctor.especialidad },
        ubicacion,
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

/** El token de gestión de un invitado identifica la cita por sí solo. */
export type AccesoCita = { citaId: string; usuarioId: string } | { token: string }

type CitaConRol = { cita: CitaRegistrada; rol: RolEnCita }

/**
 * Devuelve `null` también sin acceso, para no revelar qué identificadores existen.
 * El token se busca por su hash: nunca se compara en claro.
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

export async function obtenerCita(acceso: AccesoCita): Promise<ResultadoObtenerCita> {
    const resultado = await citaConAcceso(acceso)
    return resultado ? { ok: true, ...resultado } : { ok: false, error: "NO_ENCONTRADA" }
}

export type ErrorActualizarCita =
    | "NO_ENCONTRADA"
    | Exclude<ErrorEdicion, "NO_AUTORIZADO">
    | "CONFLICTO"

export type ResultadoActualizarCita = ({ ok: true } & CitaConRol) | { ok: false; error: ErrorActualizarCita }

/** La escritura es condicional al estado leído para no pisar un cambio concurrente. */
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

export function cancelarCita(acceso: AccesoCita, ahora: Date = new Date()) {
    return actualizarCita(acceso, { estado: "cancelada" }, ahora)
}
