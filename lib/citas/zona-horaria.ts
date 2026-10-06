// Se usa Intl y no `Temporal` porque Node 22 (CI y producción) aún no trae
// `Temporal` sin bandera.

import type { diaSemanaEnum } from "@/lib/db/schema"

export type DiaSemana = (typeof diaSemanaEnum.enumValues)[number]

export const ZONA_CONSULTORIO = "America/Mexico_City"

// En el orden de `getUTCDay`.
const DIAS_SEMANA = [
    "domingo",
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
] as const satisfies readonly DiaSemana[]

const MS_POR_DIA = 24 * 60 * 60 * 1000

const formateadores = new Map<string, Intl.DateTimeFormat>()

function formateadorDePartes(zona: string): Intl.DateTimeFormat {
    let f = formateadores.get(zona)
    if (!f) {
        f = new Intl.DateTimeFormat("en-US", {
            timeZone: zona,
            hourCycle: "h23",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        })
        formateadores.set(zona, f)
    }
    return f
}

type PartesLocales = { anio: number; mes: number; dia: number; hora: number; minuto: number; segundo: number }

function partesLocales(instante: Date, zona: string): PartesLocales {
    const partes: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {}
    for (const p of formateadorDePartes(zona).formatToParts(instante)) {
        if (p.type !== "literal") partes[p.type] = Number(p.value)
    }
    return {
        anio: partes.year ?? Number.NaN,
        mes: partes.month ?? Number.NaN,
        dia: partes.day ?? Number.NaN,
        hora: partes.hour ?? Number.NaN,
        minuto: partes.minute ?? Number.NaN,
        segundo: partes.second ?? Number.NaN,
    }
}

/** Diferencia (ms) entre la hora local de `zona` y UTC en `instante`; −6 h para CDMX. */
export function desplazamientoMs(instante: Date, zona: string): number {
    const p = partesLocales(instante, zona)
    const comoUtc = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo)
    // Los milisegundos no aparecen en las partes; se descartan de ambos lados.
    return comoUtc - (instante.getTime() - instante.getUTCMilliseconds())
}

function partesDeFecha(fecha: string): [anio: number, mes: number, dia: number] {
    const [anio, mes, dia] = fecha.split("-").map(Number)
    return [anio, mes, dia]
}

export function diaSemanaDeFecha(fecha: string): DiaSemana | undefined {
    const [anio, mes, dia] = partesDeFecha(fecha)
    return DIAS_SEMANA[new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay()]
}

/** "YYYY-MM-DD" que marca el reloj de `zona` en `instante`. */
export function fechaLocal(instante: Date, zona: string): string {
    const p = partesLocales(instante, zona)
    return `${String(p.anio).padStart(4, "0")}-${String(p.mes).padStart(2, "0")}-${String(p.dia).padStart(2, "0")}`
}

/**
 * "24:00" es la medianoche del día siguiente. En cambios de horario se comporta como
 * `Temporal` con `disambiguation: "compatible"`: una hora repetida toma la primera
 * ocurrencia y una inexistente se recorre hacia adelante el tamaño del salto.
 */
export function aInstante(fecha: string, hora: string, zona: string): Date {
    const [anio, mes, dia] = partesDeFecha(fecha)
    const [h = 0, m = 0, s = 0] = hora.split(":").map(Number)
    const relojComoUtc = Date.UTC(anio, mes - 1, dia, h, m, s)

    // Los cambios de horario están separados por meses: los desplazamientos de un
    // día antes y uno después cubren los dos lados de cualquier transición cercana.
    const antes = desplazamientoMs(new Date(relojComoUtc - MS_POR_DIA), zona)
    const despues = desplazamientoMs(new Date(relojComoUtc + MS_POR_DIA), zona)

    const candidatos = [relojComoUtc - antes, relojComoUtc - despues]
        .filter((t) => t + desplazamientoMs(new Date(t), zona) === relojComoUtc)
        .sort((a, b) => a - b)

    // Sin candidatos la hora cae en el salto: se usa el desplazamiento previo.
    return new Date(candidatos[0] ?? relojComoUtc - antes)
}

export type FechaFormateada = { fecha: string; horaInicio: string; horaFin: string }

export function formatearIntervalo(inicio: Date, fin: Date, zona: string): FechaFormateada {
    const fecha = new Intl.DateTimeFormat("es-MX", {
        timeZone: zona,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    })
    const hora = new Intl.DateTimeFormat("es-MX", {
        timeZone: zona,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    })
    return { fecha: fecha.format(inicio), horaInicio: hora.format(inicio), horaFin: hora.format(fin) }
}
