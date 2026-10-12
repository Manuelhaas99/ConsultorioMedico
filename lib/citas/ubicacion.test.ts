import { describe, expect, it } from "vitest"
import { formatearDireccion } from "./ubicacion"

describe("formatearDireccion", () => {
    it("une nombre, dirección, colonia y ciudad", () => {
        expect(formatearDireccion({ nombre: "Consultorio Centro", direccion: "Av. Juárez 10", colonia: "Centro", ciudad: "CDMX" })).toBe(
            "Consultorio Centro, Av. Juárez 10, Centro, CDMX",
        )
    })

    it("omite las partes vacías", () => {
        expect(formatearDireccion({ nombre: " ", direccion: "Calle 5 #3", colonia: null, ciudad: "Puebla" })).toBe("Calle 5 #3, Puebla")
    })
})
