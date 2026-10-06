import { seTraslapan, type Intervalo } from "./intervalos"
import { DURACION_MAX_MINUTOS, DURACION_MIN_MINUTOS } from "./schemas"
import type { Franja } from "./slots"
import { aInstante, diaSemanaDeFecha, fechaLocal, type DiaSemana } from "./zona-horaria"

const MS_POR_MINUTO = 60 * 1000

/** `ubicacionId` null: aplica en cualquier ubicación del doctor. */
export type FranjaConUbicacion = Franja & { ubicacionId: string | null }

export type ErrorIntervalo = "RANGO_INVALIDO" | "FECHA_EN_PASADO" | "DURACION_INVALIDA"

export function validarIntervalo(intervalo: Intervalo, ahora: Date): ErrorIntervalo | null {
    if (!(intervalo.fin > intervalo.inicio)) return "RANGO_INVALIDO"
    if (!(intervalo.inicio > ahora)) return "FECHA_EN_PASADO"
    return null
}

export function duracionMinutos({ inicio, fin }: Intervalo): number {
    return (fin.getTime() - inicio.getTime()) / MS_POR_MINUTO
}

/**
 * Con tipo de consulta la duración debe ser exactamente la del tipo; sin él, un
 * número entero de minutos dentro de los mismos límites que los slots.
 */
export function validarDuracion(
    intervalo: Intervalo,
    tipoConsulta: { duracionMinutos: number } | null,
): "DURACION_INVALIDA" | null {
    const minutos = duracionMinutos(intervalo)
    if (tipoConsulta) return minutos === tipoConsulta.duracionMinutos ? null : "DURACION_INVALIDA"
    const valida = Number.isInteger(minutos) && minutos >= DURACION_MIN_MINUTOS && minutos <= DURACION_MAX_MINUTOS
    return valida ? null : "DURACION_INVALIDA"
}

export function diaLocal(instante: Date, zona: string): { fecha: string; diaSemana: DiaSemana | undefined } {
    const fecha = fechaLocal(instante, zona)
    return { fecha, diaSemana: diaSemanaDeFecha(fecha) }
}

/** Une también los intervalos que solo se tocan (09–11 y 11–13 → 09–13). */
function unir(intervalos: readonly Intervalo[]): Intervalo[] {
    const ordenados = [...intervalos].sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
    const unidos: Intervalo[] = []
    for (const actual of ordenados) {
        const ultimo = unidos.at(-1)
        if (ultimo && actual.inicio <= ultimo.fin) {
            if (actual.fin > ultimo.fin) ultimo.fin = actual.fin
        } else {
            unidos.push({ ...actual })
        }
    }
    return unidos
}

/**
 * `franjas` son las del día de la semana en que empieza la cita, en hora local de `zona`.
 * Las franjas contiguas se unen: con 09–11 y 11–13 se puede reservar 10:30–11:30.
 */
export function dentroDeDisponibilidad(
    intervalo: Intervalo,
    franjas: readonly FranjaConUbicacion[],
    zona: string,
    ubicacionId: string | null,
): boolean {
    const { fecha } = diaLocal(intervalo.inicio, zona)
    const aplicables = franjas
        .filter((f) => f.ubicacionId === null || ubicacionId === null || f.ubicacionId === ubicacionId)
        .map((f) => ({ inicio: aInstante(fecha, f.horaInicio, zona), fin: aInstante(fecha, f.horaFin, zona) }))
    return unir(aplicables).some((b) => b.inicio <= intervalo.inicio && intervalo.fin <= b.fin)
}

export function chocaConBloqueos(intervalo: Intervalo, bloqueos: readonly Intervalo[]): boolean {
    return bloqueos.some((b) => seTraslapan(intervalo, b))
}
