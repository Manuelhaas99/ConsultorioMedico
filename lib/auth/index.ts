import "server-only"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { eq } from "drizzle-orm"
import { getDb } from "@/lib/db/client"
import * as schema from "@/lib/db/schema"
import { env } from "@/lib/env"

function crearAuth() {
    const db = getDb()
    const { BETTER_AUTH_SECRET, BETTER_AUTH_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env("auth")

    return betterAuth({
        secret: BETTER_AUTH_SECRET,
        baseURL: BETTER_AUTH_URL,
        database: drizzleAdapter(db, {
            provider: "pg",
            schema: {
                user: schema.usuario,
                session: schema.session,
                account: schema.account,
                verification: schema.verification,
            },
        }),
        emailAndPassword: {
            enabled: true,
        },
        socialProviders:
            GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
                ? { google: { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET } }
                : {},
        trustedOrigins:
            process.env.NODE_ENV === "development"
                ? [
                    "https://localhost:3000",
                    "https://127.0.0.1:3000",
                ]
                : [],
        databaseHooks: {
            user: {
                create: {
                    after: async (user) => {
                        await db
                            .update(schema.usuario)
                            .set({ rol: "paciente" })
                            .where(eq(schema.usuario.id, user.id))
                    },
                },
            },
        },
    })
}

export type Auth = ReturnType<typeof crearAuth>
export type Session = Auth["$Infer"]["Session"]

let instancia: Auth | null = null

export function getAuth(): Auth {
    if (!instancia) instancia = crearAuth()
    return instancia
}
