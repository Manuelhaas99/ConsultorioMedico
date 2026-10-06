@AGENTS.md
@docs/ARCHITECTURE.md

# ConsultorioMedico

Sistema de citas para consultorios dentales (México). Código, comentarios, mensajes de API y textos de UI en **español**; identificadores de dominio en español (`cita`, `doctor`, `disponibilidad`), términos técnicos genéricos pueden quedar en inglés.

## Comandos

```bash
pnpm install          # usar siempre pnpm (no npm ni yarn)
pnpm dev              # servidor de desarrollo
pnpm lint             # ESLint (next/core-web-vitals + typescript)
pnpm typecheck        # next typegen && tsc --noEmit
pnpm test             # Vitest (archivos *.test.ts junto al código)
pnpm build            # build de producción
pnpm db:generate      # generar migración desde lib/db/schema.ts
pnpm db:migrate       # aplicar migraciones
pnpm db:seed          # especialidades dentales
```

Variables de entorno: copia `.env.example` a `.env.local`.

## Antes de dar un cambio por terminado

1. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pasan (el CI corre lo mismo).
2. Si tocaste el esquema: migración generada y probada en un Postgres limpio.
3. Si tocaste lógica de negocio: prueba unitaria que falle sin el cambio y pase con él.

## Convenciones de TypeScript

- `strict` siempre. Prohibido `any`; usa `unknown` y valida con zod.
- Nada de `!` (non-null assertion) sobre `process.env`; valida variables al usarlas.
- Toda entrada externa (body, query, params, webhooks) se valida con zod antes de usarse.
- Tipos derivados del esquema (`typeof cita.$inferSelect`, `z.infer<typeof schema>`) en lugar de duplicarlos.
- Funciones pequeñas y puras donde se pueda; I/O en los bordes.
- Sin `console.log` de depuración en código commiteado; `console.error` solo para errores inesperados.

## Comentarios y documentación

- Comenta solo lo estrictamente necesario: el **porqué** que el código no puede expresar (una decisión no obvia, una restricción externa, un workaround). Nunca el qué. Si algo necesita un comentario para entenderse, primero renombra o simplifica.
- Prohibido:
  - comentarios que repiten el código o el nombre de la función;
  - encabezados decorativos;
  - bitácora ("se cambió", "antes hacía", "arreglo de X");
  - IDs de hallazgos, tickets o PRs;
  - la ruta HTTP encima de su handler;
  - referencias a otros archivos ("ver x.test.ts");
  - TODOs sin contexto.
- La documentación de API (JSDoc en funciones y tipos exportados, contratos de endpoints) se acepta solo cuando el nombre y los tipos no bastan: breve, sin repetir parámetros ni tipos, sin relleno.
- El mismo criterio aplica a docs, mensajes de commit y descripciones de PR: claro y sin texto redundante.

## Seguridad

- Autorización en el servicio del dominio, no en `proxy.ts`.
- Respuestas a través de DTOs; nunca exponer correos de terceros, tokens ni notas clínicas.
- Escapar todo valor interpolado en HTML (correos).
- Datos de salud (motivo de consulta, notas) son datos sensibles bajo la LFPDPPP.

## Flujo de trabajo

- Una rama y un PR por cambio. Mensajes de commit estilo Conventional Commits (`fix:`, `feat:`, `docs:`...).
- El dueño del repositorio revisa y hace merge; los agentes no hacen merge.
