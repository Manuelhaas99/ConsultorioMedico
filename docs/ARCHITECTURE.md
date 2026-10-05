# Arquitectura

Sistema de citas para consultorios dentales: pacientes (con cuenta o como invitados) reservan citas; el personal (doctor, secretaria, admin) gestiona agenda, disponibilidad y bloqueos.

## Estado actual

- **Next.js 16 (App Router)** con React 19. Hoy solo hay API (`app/api/**/route.ts`); la UI está por construirse.
- **Postgres + Drizzle ORM** (`lib/db`). Migraciones SQL versionadas en `lib/db/migrations`.
- **better-auth** para sesiones (email/contraseña y Google), montado en `app/api/auth/[...all]`.
- **Resend** para correos y **Upstash QStash** para recordatorios programados.
- `proxy.ts` (antes `middleware.ts`) hace solo redirecciones optimistas por cookie.

Antes de esta guía la lógica de negocio, las consultas y la autorización vivían dentro de cada route handler. La arquitectura de abajo es la que adoptamos para todo el código nuevo y para el código que se toque al arreglar bugs. No hace falta mover archivos que no se estén tocando.

## Arquitectura objetivo: capas por módulo de dominio

```
app/                         ← Capa HTTP / UI (delgada)
  api/<recurso>/route.ts       parsea entrada, llama al servicio, traduce a HTTP
  (staff)/..., (publico)/...   páginas (Server Components por defecto)

lib/
  <dominio>/                 ← Un módulo por dominio: citas, doctores, disponibilidad...
    schemas.ts                 esquemas zod de entrada/salida (compartibles con formularios)
    servicio.ts                reglas de negocio + autorización; no conoce Request/Response
    repositorio.ts             consultas Drizzle; único lugar con SQL del dominio
    dto.ts                     mapea filas a objetos seguros para exponer
    *.ts puros                 lógica sin I/O (p. ej. cálculo de slots), con pruebas
  auth/                      ← Sesión y autorización (requireSession, requireRol, políticas)
  db/                        ← Cliente, esquema y migraciones
  email/, queue/             ← Integraciones externas, inicializadas de forma perezosa
  http/                      ← Utilidades de route handlers (leerCuerpo, leerQuery, errorJson)
```

### Reglas de dependencia

1. `app/` → `lib/<dominio>/servicio` → `lib/<dominio>/repositorio` → `lib/db`. Nunca al revés.
2. Los route handlers **no** importan `lib/db` ni escriben consultas. Solo: validar entrada con zod (`leerCuerpo`/`leerQuery`), obtener sesión, llamar al servicio y mapear el resultado a HTTP.
3. Los servicios reciben datos ya validados y la identidad del usuario como argumentos explícitos (no leen `headers()`), para poder probarlos sin Next.
4. La **autorización vive en el servicio**, cerca de los datos (patrón Data Access Layer de Next). `proxy.ts` nunca es la única defensa.
5. Todo módulo de servidor empieza con `import "server-only"` (excepto lógica pura y esquemas que pueda usar el cliente).
6. Lo que se devuelve al cliente pasa por un DTO: nunca filas completas (correos, tokens, `googleRefreshToken`, notas clínicas).
7. Las integraciones (Resend, QStash) se crean de forma perezosa dentro de funciones, no al importar el módulo, para que `next build` no requiera secretos.

### Errores

- Errores de negocio esperados: el servicio devuelve un resultado tipado (`{ ok: false, error: "HORARIO_OCUPADO" }`) o lanza una clase de error de dominio; el handler lo traduce a 400/403/404/409.
- Errores inesperados: `console.error` en el servidor y 500 con mensaje genérico. Nunca se filtra el error original al cliente.
- Formato de error: `{ message: string, errores?: Record<campo, string[]> }` (ver `lib/http`).

### Fechas y zona horaria

- En la base, instantes como `timestamp with time zone`.
- La zona del consultorio es explícita (por defecto `America/Mexico_City`); la disponibilidad semanal (`hora_inicio`/`hora_fin`) está en hora local del consultorio.
- Nunca usar `Date#setHours`, `getDay` o `toLocaleString` sin `timeZone`: el servidor corre en UTC.

### Datos y concurrencia

- Invariantes críticos en la base, no solo en código: restricciones `CHECK`, `UNIQUE` y de exclusión (p. ej. que no se traslapen citas activas de un doctor).
- Operaciones de varios pasos en una transacción (`db.transaction`).
- Cambios de esquema siempre con migración generada (`pnpm db:generate`) o SQL personalizado (`drizzle-kit generate --custom`); nunca `push` en producción ni editar migraciones ya aplicadas.

### UI (cuando se construya)

- Server Components por defecto; `"use client"` solo en hojas interactivas.
- Mutaciones del personal con Server Actions que llaman a los mismos servicios de `lib/<dominio>`.
- Formularios validados con los mismos esquemas zod del dominio.
- Español (`lang="es"`), accesible (etiquetas, teclado, contraste AA) y pensado para recepción: agenda del día como vista principal.
