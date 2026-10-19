import "server-only"
import type { BetterAuthOptions } from "better-auth"
import { ROLES, type Rol } from "./roles"

export type DependenciasAuth = {
    database: BetterAuthOptions["database"]
    secret: string
    baseURL: string
    google?: { clientId: string; clientSecret: string }
    desarrollo: boolean
}

export function crearOpcionesAuth(deps: DependenciasAuth) {
    return {
        secret: deps.secret,
        baseURL: deps.baseURL,
        database: deps.database,
        emailAndPassword: {
            enabled: true,
        },
        socialProviders: deps.google ? { google: deps.google } : {},
        trustedOrigins: deps.desarrollo ? ["https://localhost:3000", "https://127.0.0.1:3000"] : [],
        // better-auth apaga la revisión de origen y el CSRF si NODE_ENV=test o si existe TEST.
        advanced: { disableOriginCheck: false },
        user: {
            additionalFields: {
                // `input: false` impide que el cliente elija su rol al registrarse o en update-user.
                rol: {
                    type: [...ROLES],
                    input: false,
                    returned: false,
                    defaultValue: "paciente" satisfies Rol,
                },
            },
        },
    } satisfies BetterAuthOptions
}
