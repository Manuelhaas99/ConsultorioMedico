import {betterAuth} from "better-auth"
import {drizzleAdapter} from "better-auth/adapters/drizzle"
import {db} from "@/lib/db/client"
import * as schema from "@/lib/db/schema"
import {eq} from "drizzle-orm"

export const auth = betterAuth({
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
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
    },
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
                        .set({rol: "paciente"})
                        .where(eq(schema.usuario.id, user.id))
                }
            }
        }
    }
})

export type Session = typeof auth.$Infer.Session