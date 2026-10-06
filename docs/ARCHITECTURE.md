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
  env.ts                     ← Variables de entorno del servidor validadas con zod, por grupo y al primer uso
```

### Reglas de dependencia

1. `app/` → `lib/<dominio>/servicio` → `lib/<dominio>/repositorio` → `lib/db`. Nunca al revés.
2. Los route handlers **no** importan `lib/db` ni escriben consultas. Solo: validar entrada con zod (`leerCuerpo`/`leerQuery`), obtener sesión, llamar al servicio y mapear el resultado a HTTP.
3. Los servicios reciben datos ya validados y la identidad del usuario como argumentos explícitos (no leen `headers()`), para poder probarlos sin Next.
4. La **autorización vive en el servicio**, cerca de los datos (patrón Data Access Layer de Next). `proxy.ts` nunca es la única defensa.
5. Todo módulo de servidor empieza con `import "server-only"` (excepto lógica pura y esquemas que pueda usar el cliente).
6. Lo que se devuelve al cliente pasa por un DTO: nunca filas completas (correos, tokens, `googleRefreshToken`, notas clínicas).
7. Las integraciones (base de datos, better-auth, Resend, QStash) se crean de forma perezosa dentro de funciones (`getDb()`, `getAuth()`, `getResend()`, `getQstashClient()`), no al importar el módulo, para que `next build` no requiera secretos. La firma de los webhooks de QStash se verifica dentro del handler (`verificarFirmaQstash`).
8. Las variables de entorno se leen con `env("<grupo>")` de `lib/env.ts` (validadas con zod), nunca con `process.env.X!`. Al agregar una variable: esquema en `lib/env.ts` y entrada en `.env.example`.
9. Los scripts que corren fuera de Next (p. ej. `db:seed` con tsx) usan `--conditions=react-server` para poder importar módulos con `server-only`.

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
- La conexión a Postgres siempre verifica el certificado TLS (`lib/db/ssl.ts`): CA del sistema o `DATABASE_CA_CERT`. Solo se desactiva TLS de forma explícita (`DATABASE_SSL=disable` o `sslmode=disable`) para un Postgres local o de CI; `sslmode=no-verify` se rechaza.
- Un solo `Pool` de `pg` por proceso (`lib/db/client.ts`): en desarrollo vive en `globalThis` para sobrevivir a las recargas en caliente. Pocas conexiones por instancia (`DATABASE_POOL_MAX`, 5 por defecto) y cierre de ociosas a los 10 s, pensado para serverless; en producción usa la URL con pooler del proveedor.
- Mientras la app no esté en producción hay una sola migración, `0000_inicial.sql`. Un cambio de esquema la regenera: borra `lib/db/migrations`, corre `pnpm db:generate --name=inicial`, vuelve a agregar a mano la extensión `btree_gist` y la restricción de exclusión, y recrea la base. Nunca `drizzle-kit push`, porque no crea esas dos piezas. Al salir a producción, cada cambio será una migración nueva y no se editarán las ya aplicadas.

### UI (cuando se construya)

- Server Components por defecto; `"use client"` solo en hojas interactivas.
- Mutaciones del personal con Server Actions que llaman a los mismos servicios de `lib/<dominio>`.
- Formularios validados con los mismos esquemas zod del dominio.
- Español (`lang="es"`), accesible (etiquetas, teclado, contraste AA) y pensado para recepción: agenda del día como vista principal.
- `app/layout.tsx` define `title.template` (`%s | Citas Dentales`): cada página exporta solo su `title`. `app/not-found.tsx` y `app/error.tsx` (Client Component con `retry()`) dan los mensajes de 404 y de error inesperado en español; nunca muestran el mensaje original del error, solo su `digest`.

### Gestión de citas de invitados (token)

- Al reservar sin cuenta se genera un token aleatorio de 256 bits. La base guarda solo su SHA-256 (`cita.token_gestion_hash`); el token en claro se devuelve una única vez en la respuesta de `POST /api/appointments` y va en el correo de confirmación. Los pacientes con cuenta no reciben token: gestionan sus citas con sesión.
- El correo enlaza a `/cita#token=<token>`. El token va en el **fragmento** para que no llegue al servidor, a los logs ni al encabezado `Referer`.
- La página `/cita` (por construir) debe ser un Client Component que lea `location.hash`, borre el fragmento de la barra (`history.replaceState`) y llame a `/api/appointments/gestion` (`GET`, `PATCH`, `DELETE`) con `Authorization: Bearer <token>`. Nunca debe pasar el token en la query string.
- Con el token se tiene el rol `paciente` de `lib/citas/politica.ts`: ver la cita, cancelarla y editar el motivo mientras sea futura y esté pendiente o confirmada.
- Los recordatorios de invitados no incluyen enlace (no se conserva el token en claro); remiten al correo de confirmación.

### Recordatorios (QStash)

- Al crear una cita, `programarRecordatorios` (`lib/queue/reminders.ts`) publica un mensaje por recordatorio futuro (24 h y 1 h antes) con `{ citaId, tipo, fechaInicio }`. Nunca lleva el correo: el destinatario se lee de la base al enviar.
- `POST /api/reminders` verifica la firma, valida el cuerpo con zod y llama a `procesarRecordatorio` (`lib/recordatorios/servicio.ts`), que omite citas inexistentes, inactivas o cuyo horario ya no coincide con `fechaInicio` (cancelar o reprogramar no requiere borrar mensajes en QStash).
- Idempotencia: el recordatorio se marca como enviado con un `UPDATE ... WHERE recordatorio_X_enviado = false RETURNING` **antes** de enviar; si Resend falla se revierte y se responde 500 para que QStash reintente. La misma clave (`claveRecordatorio`) se usa como `deduplicationId` en QStash y como `idempotencyKey` en Resend.
- Reprogramar una cita (cuando exista) debe volver a llamar a `programarRecordatorios` con la nueva fecha y poner en `false` las banderas `recordatorio_*_enviado`.
