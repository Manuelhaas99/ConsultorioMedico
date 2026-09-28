import {betterAuth, createInsufficientScopeError} from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@/lib/db/client"
import * as schema from "@/lib/db/schema"

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
    emailAndPasswordp: {
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
            ?[
                "https://localhost:3000",
                "https://127.0.0.1:3000",
            ]
            : [],
})

export type Session = typeof auth.$Infer.Session