import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

// Importación dinámica DESPUÉS de cargar el env
async function seed() {
    const { db, getPool } = await import("./client")
    const { especialidad } = await import("./schema")

    try {
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
        console.log("Especialidades insertadas")
    } finally {
        await getPool().end()
    }
}

seed().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
})
