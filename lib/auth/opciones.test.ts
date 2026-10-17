import { betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { crearOpcionesAuth, type DependenciasAuth } from "./opciones"

const SECRETO = "secreto-de-prueba-de-al-menos-32-caracteres"
const ORIGEN = "http://localhost:3000"

type Fila = Record<string, unknown>

function crearInstancia(overrides: Partial<DependenciasAuth> = {}) {
    const db: Record<string, Fila[]> = { user: [], session: [], account: [], verification: [] }
    const auth = betterAuth(
        crearOpcionesAuth({
            database: memoryAdapter(db),
            secret: SECRETO,
            baseURL: ORIGEN,
            desarrollo: false,
            ...overrides,
        }),
    )
    return { auth, db }
}

type Instancia = ReturnType<typeof crearInstancia>["auth"]

function post(auth: Instancia, ruta: string, cuerpo: unknown, headers: Record<string, string> = {}) {
    return auth.handler(
        new Request(`${ORIGEN}/api/auth${ruta}`, {
            method: "POST",
            headers: { "content-type": "application/json", origin: ORIGEN, ...headers },
            body: JSON.stringify(cuerpo),
        }),
    )
}

function cookieDe(res: Response) {
    return res.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; ")
}

const REGISTRO = { name: "Ana López", email: "ana@example.com", password: "contrasena-segura-123" }

beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "info").mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe("crearOpcionesAuth: correo y contraseña", () => {
    it("registra con rol paciente sin exponerlo, inicia sesión y la recupera", async () => {
        const { auth, db } = crearInstancia()

        const registro = await post(auth, "/sign-up/email", REGISTRO)
        expect(registro.status).toBe(200)
        expect(db.user[0].rol).toBe("paciente")
        const cuerpoRegistro: { user: Fila } = await registro.json()
        expect(cuerpoRegistro.user).not.toHaveProperty("rol")

        const entrada = await post(auth, "/sign-in/email", { email: REGISTRO.email, password: REGISTRO.password })
        expect(entrada.status).toBe(200)
        const cookie = cookieDe(entrada)
        expect(cookie).not.toBe("")

        const sesion = await auth.handler(
            new Request(`${ORIGEN}/api/auth/get-session`, { headers: { cookie } }),
        )
        expect(sesion.status).toBe(200)
        const cuerpoSesion: { user: Fila } = await sesion.json()
        expect(cuerpoSesion.user.email).toBe(REGISTRO.email)
    })

    it("rechaza una contraseña incorrecta", async () => {
        const { auth } = crearInstancia()
        await post(auth, "/sign-up/email", REGISTRO)

        const res = await post(auth, "/sign-in/email", { email: REGISTRO.email, password: "otra-contrasena-123" })
        expect(res.status).toBe(401)
        expect(await res.json()).toMatchObject({ code: "INVALID_EMAIL_OR_PASSWORD" })
    })
})

describe("crearOpcionesAuth: el cliente no elige su rol", () => {
    it("ignora rol en el registro", async () => {
        const { auth, db } = crearInstancia()

        const res = await post(auth, "/sign-up/email", { ...REGISTRO, rol: "admin" })
        expect(res.status).toBe(200)
        expect(db.user[0].rol).toBe("paciente")
    })

    it("rechaza rol en update-user sin cambiar nada", async () => {
        const { auth, db } = crearInstancia()
        const cookie = cookieDe(await post(auth, "/sign-up/email", REGISTRO))

        const res = await post(auth, "/update-user", { name: "Otro", rol: "admin" }, { cookie })
        expect(res.status).toBe(400)
        expect(await res.json()).toMatchObject({ code: "FIELD_NOT_ALLOWED" })
        expect(db.user[0]).toMatchObject({ name: REGISTRO.name, rol: "paciente" })
    })
})

describe("crearOpcionesAuth: Google", () => {
    it("monta Google con credenciales", async () => {
        const { auth } = crearInstancia({ google: { clientId: "id", clientSecret: "secreto" } })

        const res = await post(auth, "/sign-in/social", { provider: "google", callbackURL: "/" })
        expect(res.status).toBe(200)
        const cuerpo: { url: string } = await res.json()
        expect(cuerpo.url.startsWith("https://accounts.google.com/")).toBe(true)
    })

    it("no monta Google sin credenciales", async () => {
        const { auth } = crearInstancia()

        const res = await post(auth, "/sign-in/social", { provider: "google", callbackURL: "/" })
        expect(res.status).toBe(404)
        expect(await res.json()).toMatchObject({ code: "PROVIDER_NOT_FOUND" })
    })
})

describe("crearOpcionesAuth: orígenes de desarrollo", () => {
    const origenHttps = { origin: "https://localhost:3000" }

    it("acepta https://localhost:3000 en desarrollo", async () => {
        const { auth } = crearInstancia({ desarrollo: true })

        const res = await post(auth, "/sign-up/email", REGISTRO, origenHttps)
        expect(res.status).toBe(200)
    })

    it("rechaza ese origen fuera de desarrollo", async () => {
        const { auth } = crearInstancia({ desarrollo: false })

        const res = await post(auth, "/sign-up/email", REGISTRO, origenHttps)
        expect(res.status).toBe(403)
        expect(await res.json()).toMatchObject({ code: "INVALID_ORIGIN" })
    })
})
