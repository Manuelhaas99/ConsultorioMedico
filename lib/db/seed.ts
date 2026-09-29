import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

// Importación dinámica DESPUÉS de cargar el env
async function seed() {
    const { db } = await import("./client")
    const { especialidad } = await import("./schema")

    await db
        .insert(especialidad)
        .values([
            { nombre: "Odontología General", icono: "tooth" },
            { nombre: "Ortodoncia", icono: "braces" },
            { nombre: "Endodoncia", icono: "root-canal" },
            { nombre: "Periodoncia", icono: "gums" },
            { nombre: "Odontopediatría", icono: "child" },
        ])
        .onConflictDoNothing()

    console.log("✅ Especialidades insertadas")
    process.exit(0)
}

seed()