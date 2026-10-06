
const FUNCIONES = [
  {
    titulo: "Reserva con o sin cuenta",
    texto:
      "El paciente elige doctor, ubicación y horario. Puede reservar con su cuenta o como invitado dejando nombre y correo.",
  },
  {
    titulo: "Horarios reales",
    texto:
      "Solo se ofrecen horarios dentro de la disponibilidad del doctor, sin bloqueos ni citas que se traslapen, en la hora del consultorio.",
  },
  {
    titulo: "Correos y recordatorios",
    texto:
      "Al reservar llega un correo con los datos de la cita, y recordatorios 24 horas y 1 hora antes.",
  },
  {
    titulo: "Agenda del consultorio",
    texto:
      "Doctores y secretarias administran la disponibilidad semanal, bloquean horarios y actualizan el estado de cada cita.",
  },
] as const;

export default function Inicio() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-6 py-16 sm:py-24">
      <header className="flex flex-col gap-4">
        <p className="text-sm font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">
          Consultorios dentales
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl dark:text-zinc-50">
          Citas dentales sin llamadas ni hojas de cálculo
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-zinc-700 dark:text-zinc-300">
          Un sistema para que los pacientes agenden su cita en línea y el consultorio lleve su agenda en un solo
          lugar.
        </p>
      </header>

      <section aria-labelledby="funciones">
        <h2 id="funciones" className="sr-only">
          Qué incluye
        </h2>
        <ul className="grid gap-6 sm:grid-cols-2">
          {FUNCIONES.map(({ titulo, texto }) => (
            <li key={titulo} className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
              <h3 className="font-semibold text-zinc-950 dark:text-zinc-50">{titulo}</h3>
              <p className="mt-2 leading-7 text-zinc-700 dark:text-zinc-300">{texto}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="rounded-lg bg-zinc-100 p-5 leading-7 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        Estamos construyendo la reserva en línea desde esta página. Mientras tanto, comunícate directamente con tu
        consultorio para agendar.
      </p>
    </main>
  );
}
