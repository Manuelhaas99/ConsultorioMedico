import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Página no encontrada",
};

export default function NoEncontrada() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-6 py-16">
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Error 404</p>
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">No encontramos esta página</h1>
      <p className="leading-7 text-zinc-700 dark:text-zinc-300">
        Es posible que el enlace esté incompleto o que la página ya no exista.
      </p>
      <Link
        href="/"
        className="self-start rounded-md font-medium text-blue-700 underline underline-offset-4 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:text-blue-300 dark:hover:text-blue-100"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
