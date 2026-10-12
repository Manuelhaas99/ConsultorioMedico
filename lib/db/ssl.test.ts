import { describe, expect, it } from "vitest"
import { ConfiguracionBaseDatosError, configuracionConexion } from "./ssl"

const URL_BASE = "postgres://app:secreto@db.example.com:5432/citas"
const PEM = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----"

describe("configuracionConexion", () => {
    it("por defecto verifica el certificado (nunca rejectUnauthorized: false)", () => {
        expect(configuracionConexion({ DATABASE_URL: URL_BASE })).toEqual({
            connectionString: URL_BASE,
            ssl: { rejectUnauthorized: true },
        })
    })

    it.each(["require", "verify-ca", "verify-full", "prefer"])("sslmode=%s se traduce a TLS verificado", (modo) => {
        const r = configuracionConexion({ DATABASE_URL: `${URL_BASE}?sslmode=${modo}&application_name=citas` })
        expect(r.ssl).toEqual({ rejectUnauthorized: true })
        expect(r.connectionString).toBe(`${URL_BASE}?application_name=citas`)
    })

    it("usa la CA de DATABASE_CA_CERT, aceptando \\n escapados", () => {
        const r = configuracionConexion({
            DATABASE_URL: `${URL_BASE}?sslmode=require`,
            DATABASE_CA_CERT: PEM.replace(/\n/g, "\\n"),
        })
        expect(r.ssl).toEqual({ rejectUnauthorized: true, ca: PEM })
    })

    it("rechaza una CA que no es PEM", () => {
        expect(() => configuracionConexion({ DATABASE_URL: URL_BASE, DATABASE_CA_CERT: "abc" })).toThrow(
            ConfiguracionBaseDatosError,
        )
    })

    it("desactiva TLS solo si se pide explícitamente", () => {
        expect(configuracionConexion({ DATABASE_URL: URL_BASE, DATABASE_SSL: "disable" }).ssl).toBe(false)
        const r = configuracionConexion({ DATABASE_URL: `${URL_BASE}?sslmode=disable` })
        expect(r).toEqual({ connectionString: URL_BASE, ssl: false })
    })

    it("rechaza los modos que aceptan cualquier certificado", () => {
        expect(() => configuracionConexion({ DATABASE_URL: `${URL_BASE}?sslmode=no-verify` })).toThrow(/no-verify/)
        expect(() => configuracionConexion({ DATABASE_URL: `${URL_BASE}?ssl=no-verify` })).toThrow(/no-verify/)
    })

    it("rechaza valores desconocidos o contradictorios", () => {
        expect(() => configuracionConexion({ DATABASE_URL: URL_BASE, DATABASE_SSL: "off" })).toThrow(/DATABASE_SSL/)
        expect(() => configuracionConexion({ DATABASE_URL: `${URL_BASE}?sslmode=quiza` })).toThrow(/sslmode/)
        expect(() =>
            configuracionConexion({ DATABASE_URL: `${URL_BASE}?sslmode=require`, DATABASE_SSL: "disable" }),
        ).toThrow(/contradice/)
        expect(() =>
            configuracionConexion({ DATABASE_URL: `${URL_BASE}?sslmode=disable`, DATABASE_SSL: "verify-full" }),
        ).toThrow(/contradice/)
    })

    it("no mezcla DATABASE_CA_CERT con certificados en la URL", () => {
        expect(() =>
            configuracionConexion({ DATABASE_URL: `${URL_BASE}?sslrootcert=/etc/ca.pem`, DATABASE_CA_CERT: PEM }),
        ).toThrow(/no ambos/)
    })

    it("exige DATABASE_URL válida", () => {
        expect(() => configuracionConexion({})).toThrow(/DATABASE_URL/)
        expect(() => configuracionConexion({ DATABASE_URL: "no es url" })).toThrow(/DATABASE_URL/)
    })
})
