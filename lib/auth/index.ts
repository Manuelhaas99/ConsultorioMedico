import "server-only"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { getDb } from "@/lib/db/client"
import * as schema from "@/lib/db/schema"
import { env } from "@/lib/env"
import { crearOpcionesAuth } from "./opciones"

function crearAuth() {
    const { BETTER_AUTH_SECRET, BETTER_AUTH_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env("auth")

    return betterAuth(
        crearOpcionesAuth({
            database: drizzleAdapter(getDb(), {
                provider: "pg",
                schema: {
                    user: schema.usuario,
                    session: schema.session,
                    account: schema.account,
                    verification: schema.verification,
                },
            }),
            secret: BETTER_AUTH_SECRET,
            baseURL: BETTER_AUTH_URL,
            google:
                GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
                    ? { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET }
                    : undefined,
            desarrollo: process.env.NODE_ENV === "development",
        }),
    )
}

export type Auth = ReturnType<typeof crearAuth>
export type Session = Auth["$Infer"]["Session"]

let instancia: Auth | null = null

export function getAuth(): Auth {
    if (!instancia) instancia = crearAuth()
    return instancia
}
