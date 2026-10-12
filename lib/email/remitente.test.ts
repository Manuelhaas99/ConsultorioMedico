import { describe, expect, it } from "vitest"
import { leerEntorno } from "@/lib/env"
import { REMITENTE_DESARROLLO, resolverRemitente } from "./remitente"

describe("resolverRemitente", () => {
    it("usa EMAIL_FROM cuando está definido", () => {
        expect(resolverRemitente({ EMAIL_FROM: "Clínica Sonrisa <citas@sonrisa.mx>", NODE_ENV: "production" })).toBe(
            "Clínica Sonrisa <citas@sonrisa.mx>",
        )
    })

    it("en desarrollo cae al remitente de pruebas de Resend", () => {
        expect(resolverRemitente({ NODE_ENV: "development" })).toBe(REMITENTE_DESARROLLO)
        expect(resolverRemitente({})).toBe(REMITENTE_DESARROLLO)
    })

    it("en producción exige EMAIL_FROM (onboarding@resend.dev solo entrega al dueño de la cuenta)", () => {
        expect(() => resolverRemitente({ NODE_ENV: "production" })).toThrowError(/EMAIL_FROM: falta/)
    })
})

describe("EMAIL_FROM en lib/env", () => {
    it.each(["citas@sonrisa.mx", "Clínica Sonrisa <citas@sonrisa.mx>"])("acepta %s", (valor) => {
        expect(leerEntorno("correo", { EMAIL_FROM: valor }).EMAIL_FROM).toBe(valor)
    })

    it.each(["citas", "Clínica <citas>", "a@b.mx\r\nBcc: x@y.mx"])("rechaza %j", (valor) => {
        expect(() => leerEntorno("correo", { EMAIL_FROM: valor })).toThrowError(/EMAIL_FROM/)
    })
})
