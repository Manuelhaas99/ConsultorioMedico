import { describe, expect, it } from "vitest"
import { datosConfirmacion, type CitaCreada } from "./confirmacion"

const creada: CitaCreada = {
    cita: {
        estado: "pendiente",
        fechaInicio: new Date("2026-10-12T15:00:00.000Z"),
        fechaFin: new Date("2026-10-12T15:30:00.000Z"),
    },
    doctor: { nombre: "Dra. López", especialidad: "Ortodoncia" },
    ubicacion: null,
    contacto: { nombre: "Ana", email: "ana@example.com" },
    tokenGestion: null,
}

describe("datosConfirmacion", () => {
    it("usa la especialidad real del doctor y el estado de la cita", () => {
        expect(datosConfirmacion(creada)).toEqual({
            email: "ana@example.com",
            estado: "pendiente",
            nombrePaciente: "Ana",
            nombreDoctor: "Dra. López",
            especialidad: "Ortodoncia",
            fechaInicio: creada.cita.fechaInicio,
            fechaFin: creada.cita.fechaFin,
        })
    })

    it("incluye la dirección de la ubicación y el token del invitado", () => {
        const r = datosConfirmacion({
            ...creada,
            ubicacion: { nombre: "Consultorio Centro", direccion: "Av. Juárez 10", colonia: null, ciudad: "CDMX" },
            tokenGestion: "tok",
        })
        expect(r).toMatchObject({ direccion: "Consultorio Centro, Av. Juárez 10, CDMX", tokenGestion: "tok" })
    })

    it("no confirma una cita que ya no está activa", () => {
        expect(datosConfirmacion({ ...creada, cita: { ...creada.cita, estado: "cancelada" } })).toBeNull()
    })
})
