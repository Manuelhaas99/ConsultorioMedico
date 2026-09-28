import {
    pgTable,
    text,
    timestamp,
    boolean,
    integer,
    uuid,
    pgEnum,
    time,
} from "drizzle-orm/pg-core"

// ── Enums ──────────────────────────────────────────
export const rolEnum = pgEnum("rol", [
    "paciente",
    "medico",
    "secretario",
    "admin",
])

export const estadoCitaEnum = pgEnum("estado_cita", [
    "pendiente",
    "confirmada",
    "cancelada",
    "completada",
    "no_show",
])

export const diaSemanaEnum = pgEnum("dia_semana", [
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
    "domingo",
])

// ── Especialidad ───────────────────────────────────
export const especialidad = pgTable("especialidad", {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull().unique(),
    icono: text("icono"),
    creadoEn: timestamp("creado_en").defaultNow().notNull(),
})

// ── Usuario (mejor-auth lo genera, solo extendemos) ─
export const usuario = pgTable("usuario", {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    email: text("email").notNull().unique(),
    emailVerificado: boolean("email_verificado").default(false).notNull(),
    telefono: text("telefono"),
    telefonoVerificado: boolean("telefono_verificado").default(false).notNull(),
    avatarUrl: text("avatar_url"),
    rol: rolEnum("rol").default("paciente").notNull(),
    creadoEn: timestamp("creado_en").defaultNow().notNull(),
    actualizadoEn: timestamp("actualizado_en").defaultNow().notNull(),
})

// ── Doctor ─────────────────────────────────────────
export const doctor = pgTable("doctor", {
    id: uuid("id").primaryKey().defaultRandom(),
    usuarioId: uuid("usuario_id")
        .notNull()
        .references(() => usuario.id, { onDelete: "cascade" }),
    especialidadId: uuid("especialidad_id")
        .notNull()
        .references(() => especialidad.id),
    cedula: text("cedula").notNull().unique(),
    bio: text("bio"),
    aprobado: boolean("aprobado").default(false).notNull(),
    googleCalendarId: text("google_calendar_id"),
    googleRefreshToken: text("google_refresh_token"),
    creadoEn: timestamp("creado_en").defaultNow().notNull(),
})

// ── Ubicacion (consultorio) ────────────────────────
export const ubicacion = pgTable("ubicacion", {
    id: uuid("id").primaryKey().defaultRandom(),
    doctorId: uuid("doctor_id")
        .notNull()
        .references(() => doctor.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    direccion: text("direccion").notNull(),
    ciudad: text("ciudad").notNull(),
    colonia: text("colonia"),
    urlMapa: text("url_mapa"),
    creadoEn: timestamp("creado_en").defaultNow().notNull(),
})

// ── Tipo de consulta ───────────────────────────────
export const tipoConsulta = pgTable("tipo_consulta", {
    id: uuid("id").primaryKey().defaultRandom(),
    doctorId: uuid("doctor_id")
        .notNull()
        .references(() => doctor.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    duracionMinutos: integer("duracion_minutos").notNull().default(30),
    creadoEn: timestamp("creado_en").defaultNow().notNull(),
})

// ── Disponibilidad del doctor ──────────────────────
export const disponibilidadDoctor = pgTable("disponibilidad_doctor", {
    id: uuid("id").primaryKey().defaultRandom(),
    doctorId: uuid("doctor_id")
        .notNull()
        .references(() => doctor.id, { onDelete: "cascade" }),
    ubicacionId: uuid("ubicacion_id")
        .references(() => ubicacion.id),
    diaSemana: diaSemanaEnum("dia_semana").notNull(),
    horaInicio: time("hora_inicio").notNull(),
    horaFin: time("hora_fin").notNull(),
})

// ── Bloqueo de horario ─────────────────────────────
export const bloqueoHorario = pgTable("bloqueo_horario", {
    id: uuid("id").primaryKey().defaultRandom(),
    doctorId: uuid("doctor_id")
        .notNull()
        .references(() => doctor.id, { onDelete: "cascade" }),
    fechaInicio: timestamp("fecha_inicio").notNull(),
    fechaFin: timestamp("fecha_fin").notNull(),
    motivo: text("motivo"),
    creadoEn: timestamp("creado_en").defaultNow().notNull(),
})

// ── Secretario ─────────────────────────────────────
export const secretario = pgTable("secretario", {
    id: uuid("id").primaryKey().defaultRandom(),
    usuarioId: uuid("usuario_id")
        .notNull()
        .references(() => usuario.id, { onDelete: "cascade" }),
    doctorId: uuid("doctor_id")
        .notNull()
        .references(() => doctor.id, { onDelete: "cascade" }),
    creadoEn: timestamp("creado_en").defaultNow().notNull(),
})

// ── Cita ───────────────────────────────────────────
export const cita = pgTable("cita", {
    id: uuid("id").primaryKey().defaultRandom(),
    doctorId: uuid("doctor_id")
        .notNull()
        .references(() => doctor.id),
    pacienteId: uuid("paciente_id")
        .references(() => usuario.id),
    ubicacionId: uuid("ubicacion_id")
        .references(() => ubicacion.id),
    tipoConsultaId: uuid("tipo_consulta_id")
        .references(() => tipoConsulta.id),
    // Para reservas como invitado (sin cuenta)
    invitadoNombre: text("invitado_nombre"),
    invitadoEmail: text("invitado_email"),
    invitadoTelefono: text("invitado_telefono"),
    fechaInicio: timestamp("fecha_inicio").notNull(),
    fechaFin: timestamp("fecha_fin").notNull(),
    estado: estadoCitaEnum("estado").default("pendiente").notNull(),
    motivoConsulta: text("motivo_consulta"),
    notas: text("notas"),
    googleCalendarEventId: text("google_calendar_event_id"),
    tokenGestion: text("token_gestion").unique(), // para gestionar sin login
    recordatorio24hEnviado: boolean("recordatorio_24h_enviado").default(false).notNull(),
    recordatorio1hEnviado: boolean("recordatorio_1h_enviado").default(false).notNull(),
    asistio: boolean("asistio"),
    creadoEn: timestamp("creado_en").defaultNow().notNull(),
    actualizadoEn: timestamp("actualizado_en").defaultNow().notNull(),
})

// ── Better-auth tables ─────────────────────────────
export const session = pgTable("session", {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
        .notNull()
        .references(() => usuario.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
        .notNull()
        .references(() => usuario.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
})

export const verification = pgTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
})