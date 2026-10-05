"use client";

import { useEffect } from "react";

type PropsError = {
  error: Error & { digest?: string };
  retry: () => void;
};

export default function ErrorInesperado({ error, retry }: PropsError) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Algo salió mal</h1>
      <p className="leading-7 text-zinc-700 dark:text-zinc-300">
        Ocurrió un error inesperado. Puedes intentarlo de nuevo en un momento.
      </p>
      {/* En producción Next solo envía al cliente un identificador, no el mensaje original. */}
      {error.digest && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Código de referencia: <code className="font-mono">{error.digest}</code>
        </p>
      )}
      <button
        type="button"
        onClick={() => retry()}
        className="self-start rounded-md bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        Intentar de nuevo
      </button>
    </main>
  );
}
