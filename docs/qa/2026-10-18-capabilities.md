# Capabilities de la app y brechas para operar — 2026-10-18

Análisis hecho a partir de los 5 reportes de `docs/qa/2026-10-18-*`, `docs/ARCHITECTURE.md`, `CLAUDE.md` y el código de `app/**`, `lib/**`, `proxy.ts` y `lib/db/schema.ts`. Sirve como guía de conversación con el propietario del producto. Solo lectura: no se modificó código ni la base.

Convenciones:
- **NV** = no verificado por QA (solo está en el código).
- No hay ninguna UI: todo lo de abajo es por API.

## Contradicciones entre los reportes y el código

1. **El bug del secretario no afecta a las citas.** El resumen de QA sospechaba que `lib/citas/repositorio.ts:115` tenía el mismo bug que `relacionConDoctor`; es falso.
   - En `lib/citas/repositorio.ts` la subconsulta va en el `WHERE`, y ahí Drizzle sí califica las columnas: `... "secretario"."doctor_id" = "doctor"."id" ...`.
   - En `lib/doctores/repositorio.ts:103` la subconsulta va en un campo del `SELECT`, y ahí no las califica: `"doctor_id" = "id"`.
   - El reporte de citas lo confirma: «Secretario `pendiente→confirmada` + `notas`: 200».
   - Conclusión: el secretario **sí** gestiona citas (por id) y **no** gestiona la agenda.
2. **`app/page.tsx` promete cosas que no existen.** Dice «El paciente elige doctor, ubicación y horario» y «Doctores y secretarias administran la disponibilidad semanal». No hay UI de reserva ni de agenda, y el secretario no puede administrar disponibilidad (QA-DOCTORES-01). La misma página admite: «Estamos construyendo la reserva en línea».
3. **`proxy.ts:7-9` redirige a páginas que no existen.** Usa `/dashboard`, `/login` y `/registro`, pero la única página es `app/page.tsx`.

## Parte 1 — Qué puede hacer cada rol hoy

### Visitante e invitado sin cuenta

| Capability | Estado | Evidencia |
|---|---|---|
| Ver especialidades | Sí | `GET /api/specialties` (QA doctores, 200). Las especialidades solo entran por `pnpm db:seed` (`lib/db/seed.ts`). |
| Buscar doctores por especialidad o ciudad | Sí | `GET /api/doctors?especialidad=&ciudad=` (QA, 200). Solo aprobados. El filtro de ciudad no ignora acentos. |
| Ver perfil del doctor (ubicaciones, disponibilidad, tipos de consulta) | Sí | `GET /api/doctors/[id]` (QA: «aprobado, anónimo: 200 con ubicaciones, disponibilidad y tiposConsulta»). |
| Ver horarios libres | Parcial | `GET /api/doctors/[id]/slots?fecha&duracion` funciona, pero tiene 4 problemas (abajo). |
| Crear cita como invitado | Sí | `POST /api/appointments` con `invitadoNombre` e `invitadoEmail` → 201 con `tokenGestion` (QA citas). |
| Elegir doctor, ubicación, tipo y horario al reservar | Sí, por API | `doctorId`, `ubicacionId`, `tipoConsultaId` y `fechaInicio`/`fechaFin` en `lib/citas/schemas.ts:36-54`. Se validan pertenencia, duración del tipo, disponibilidad, bloqueos y traslapes (QA citas). |
| Ver, editar el motivo o cancelar su cita | Sí, por API | `GET`/`PATCH`/`DELETE /api/appointments/gestion` con `Authorization: Bearer` (QA citas, «Gestión por token»). |
| Hacerlo desde la página `/cita` del correo | No | `app/cita` no existe. El correo enlaza a `/cita#token=` (`lib/email/templates.ts:44`). |
| Reprogramar | No | `actualizarCitaSchema` es `strictObject` sin campos de fecha (`lib/citas/schemas.ts:73-84`). QA: `fechaInicio` en PATCH → 400. |

Problemas de `/slots`:
- devuelve slots duplicados y desordenados (QA-DOCTORES-02);
- responde 200 para doctores sin aprobar o inexistentes (QA-DOCTORES-03);
- marca como disponibles slots en el pasado (QA-DOCTORES-04);
- ignora el tipo de consulta y la ubicación.

### Paciente con cuenta

| Capability | Estado | Evidencia |
|---|---|---|
| Registro, login y logout por correo | Sí | QA auth, «Registro» y «Login / sesión / logout». |
| Crear cita | Sí | QA citas: «Feliz, con cuenta, ubicación y tipo (201, sin `tokenGestion`)». |
| Listar sus citas | Sí | `GET /api/appointments` → `citasDePaciente` (`lib/citas/repositorio.ts:97`). No incluye citas ajenas. |
| Ver una cita | Sí | `GET /api/appointments/[id]`. Una cita ajena da 404. |
| Editar el motivo | Sí | `PATCH [id]` solo si la cita es futura y está pendiente o confirmada (`lib/citas/politica.ts:65-71`). |
| Cancelar | Sí | `DELETE [id]` o `PATCH {"estado":"cancelada"}` (200; repetir → 409). |
| Reprogramar | No | Igual que el invitado. La única vía es cancelar y volver a reservar. |
| Editar nombre e imagen del perfil | Sí, con bug | `POST /api/auth/update-user`. Acepta `javascript:` en `image` (QA-AUTH-02). |
| Editar teléfono | No | La columna `usuario.telefono` existe, pero ninguna ruta la usa. |
| Ver su propio rol | No | `get-session` no lo incluye. |
| Cambiar contraseña | Parcial | `change-password` existe. QA solo probó el caso inválido (400). |
| Cambiar correo | No | `400 CHANGE_EMAIL_DISABLED`. |
| Recuperar contraseña | No | `400 RESET_PASSWORD_DISABLED`. `lib/auth/index.ts:25-27` no configura `sendResetPassword`. |
| Verificación de correo | No | `emailVerified=false` y el registro inicia sesión de inmediato. |
| Login con Google | Parcial, NV | Solo se activa con `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (`lib/auth/index.ts:28-31`). Sin claves: `404 PROVIDER_NOT_FOUND`. |
| Solicitar ser doctor | Sí | `POST /api/doctors` (solo rol `paciente`) → 201 con `aprobado:false`. |
| Borrar su cuenta | No determinado | No está configurado. `DELETE usuario` con citas falla por la FK `cita_paciente_id_usuario_id_fk`. |

### Doctor (rol `medico`, dueño del perfil)

| Capability | Estado | Evidencia |
|---|---|---|
| Ver su agenda (lista de citas) | **No** | `GET /api/appointments` solo devuelve citas donde el usuario es paciente. Para el doctor responde `{"citas":[]}` (QA citas). Solo puede abrir una cita si ya conoce su id. |
| Ver una cita suya con notas | Sí | `GET [id]` con rol `personal`. El DTO incluye `notas` y `asistio`. |
| Confirmar | Sí | `pendiente→confirmada` (`lib/citas/politica.ts:30-36`). |
| Cancelar | Sí | Desde `pendiente` o `confirmada` (QA concurrencia). |
| Marcar completada o no_show | Sí, solo desde `confirmada` | `confirmada→completada` 200; `pendiente→completada/no_show` 409. También se permite en citas futuras. `asistio` nunca se actualiza. |
| Agregar notas clínicas | Sí | En cualquier estado, incluso con la cita completada. |
| Mover una cita a otra fecha | **No** | No hay campos de fecha en el PATCH. |
| Crear una cita en nombre de un paciente | No | `crearCita` asigna como paciente al usuario de la sesión (`lib/citas/servicio.ts:143`). NV como flujo de recepción. |
| Crear bloqueos | Sí | `POST /api/doctors/[id]/blocks` → 201. Acepta fechas pasadas. |
| Listar bloqueos con motivo | Sí | El dueño ve `motivo`. |
| Editar o borrar bloqueos | **No** | No existe PATCH ni DELETE. |
| Configurar disponibilidad | Sí, con bug | `POST .../availability` → 201. Acepta franjas traslapadas (QA-DOCTORES-02). |
| Editar o borrar disponibilidad | **No** | No existe ruta. Un error de captura no se puede corregir por API. |
| Crear o editar ubicaciones y tipos de consulta | **No** | No existe ruta. Los testers los crearon con SQL. |
| Configurar la agenda sin estar aprobado | Sí | 201 (QA doctores). |

### Secretario

| Capability | Estado | Evidencia |
|---|---|---|
| Que alguien le asigne el rol o lo vincule a un doctor | No | No hay endpoint. QA usó SQL. Ningún código inserta en la tabla `secretario`. |
| Ver, confirmar, cancelar, completar y anotar citas de su doctor (por id) | Sí | QA citas: `pendiente→confirmada` + notas 200. `esPersonalDelDoctor` funciona. |
| Ver la agenda (lista) | No | Mismo hueco que el doctor. |
| Disponibilidad y bloqueos de su doctor | **No (bug)** | `POST availability/blocks` → 403. `GET` del perfil de un doctor sin aprobar → 404 (QA-DOCTORES-01, `lib/doctores/repositorio.ts:103`). |
| Ver el motivo de los bloqueos | No | Por el mismo bug. QA no pudo probarlo. |

### Admin

| Capability | Estado | Evidencia |
|---|---|---|
| Que alguien le asigne el rol | No | Solo por SQL. |
| Aprobar doctores | Sí | `PATCH /api/doctors/[id]/aprobacion` → 200 y el rol pasa a `medico`. |
| Revocar una aprobación | No | No existe ruta. |
| Ver doctores sin aprobar | Parcial | Solo por id. No hay listado de solicitudes pendientes: `listarDoctores` solo devuelve aprobados (`lib/doctores/servicio.ts:96-98`). |
| Gestionar la agenda de cualquier doctor | No | 403 por diseño (`lib/doctores/politica.ts:36-38`). |
| Ver citas | No | `esPersonalDelDoctor` no incluye al admin, así que recibe 404. NV. |
| Gestionar especialidades, usuarios o roles | No | No existen rutas. |

### Notificaciones

| Capability | Estado | Evidencia |
|---|---|---|
| Correo de confirmación al reservar | Parcial, NV | `notificarCitaCreada` (`lib/citas/notificaciones.ts`). Requiere `RESEND_API_KEY`, y en producción `EMAIL_FROM` con dominio verificado. En desarrollo usa `onboarding@resend.dev`, que solo entrega al dueño de la cuenta (`lib/email/remitente.ts`). Sin claves la cita se crea igual (201). Ningún correo se envió en QA. |
| Recordatorios 24 h y 1 h antes | Parcial, NV | Necesita `QSTASH_TOKEN`, las dos claves de firma y que `BETTER_AUTH_URL` sea alcanzable por QStash. La lógica se probó contra la base; la firma y el envío reales no. Sin claves, el webhook responde 500 con cuerpo vacío (QA-RECORDATORIOS-BD-01). |
| Correo al confirmar, cancelar o cambiar una cita | No | Las únicas llamadas a correo son la de creación y la de recordatorio. |
| Aviso al doctor de una cita nueva | No | `enviarConfirmacionCita` solo se envía al paciente. |
| Sincronizar con Google Calendar | No | Las columnas `googleCalendarId`, `googleRefreshToken` y `googleCalendarEventId` existen pero ningún código las usa. |

## Parte 2 — Capabilities vitales, por prioridad

- **[B]** = brecha demostrada en el código o en QA.
- **[I]** = práctica general de la industria; no aparece en el repo.

### P0 — imprescindible para operar

1. **UI mínima [B].** Reserva pública (especialidad → doctor → slot → datos), login y registro, página `/cita` para invitados y agenda del día para recepción. Hoy solo existe `app/page.tsx`; `ARCHITECTURE.md` ya define `/cita` y la agenda como vista principal. Se reutiliza toda la API, los esquemas zod, `lib/auth/client.ts` y `proxy.ts`.
2. **Endpoint de agenda del personal [B].** Listar las citas de un doctor por rango de fechas, para el doctor y sus secretarios. Hoy el doctor recibe `{"citas":[]}`. Se reutilizan `esPersonalDelDoctor`, `citaParaPersonal` y el índice `cita_doctor_id_fecha_inicio_idx`.
3. **Arreglar `relacionConDoctor` y gestionar secretarios y roles [B].** Corregir el bug y poder vincular un secretario a un doctor y asignar roles; hoy solo por SQL. Se reutilizan `esPersonalDelDoctor`, `requireRol` y la tabla `secretario`.
4. **CRUD de ubicaciones y tipos de consulta [B].** Un doctor nuevo no puede darlos de alta sin SQL. Se reutilizan las tablas, los DTOs públicos y `autorizarAgenda`.
5. **Editar y borrar disponibilidad y bloqueos, e impedir traslapes [B].** Hoy un error de captura es irreversible por API, y hay traslapes duplicados. Se reutiliza `autorizarAgenda` y el patrón de restricción de exclusión de `cita`.
6. **`/slots` confiable [B].** Deduplicar y ordenar, marcar el pasado como no disponible, 404 para doctores sin aprobar o inexistentes, y aceptar `tipoConsultaId` y `ubicacionId`. La UI de reserva depende de este endpoint. Se reutilizan `generarSlots`, `dentroDeDisponibilidad` y `vistaPara`.
7. **Correo y recordatorios configurados y probados de punta a punta [B].** El invitado depende del correo para recuperar su token, que se entrega una sola vez. Todo el módulo de correo y QStash ya existe; falta configuración, prueba real y corregir QA-RECORDATORIOS-BD-01.
8. **Reserva hecha por el personal en nombre de un paciente [B en el código; la necesidad es I].** `crearCita` asigna como paciente al usuario de la sesión, y `ARCHITECTURE.md` dice que la UI está «pensada para recepción». Se reutiliza `crearCita` con un contexto de actor del personal y datos de invitado.

### P1 — necesaria pronto

1. **Reprogramar citas [B].** No existe. `ARCHITECTURE.md` ya especifica cómo: volver a llamar a `programarRecordatorios` y poner en `false` las banderas `recordatorio_*_enviado`. Se reutilizan `reservarCita`, `actualizarCitaSiEstado` y `motivoParaOmitir`.
2. **Recuperación de contraseña y verificación de correo [B].** Ambas están desactivadas. Se reutilizan better-auth (`sendResetPassword`, `sendVerificationEmail`), Resend y `lib/email/html.ts`.
3. **Rate limiting [B].** 15 intentos de login fallidos seguidos sin bloqueo, y reservas de invitado sin límite que permiten acaparar huecos. Better-auth tiene rate limit; para las reservas no hay nada.
4. **Notificar cambios de estado al paciente y avisar al doctor de citas nuevas [B; la necesidad es I].** `textosConfirmacion` ya maneja el estado `confirmada`.
5. **Corregir los bugs medios:** byte NUL → 500 (QA-CITAS-01), `image` acepta `javascript:` (QA-AUTH-02), longitudes en el registro (QA-AUTH-03), `errores:{}` vacío (QA-CITAS-02).
6. **Admin [B].** Listado de doctores pendientes, revocar aprobaciones y decidir si gestiona agendas.
7. **Exponer el rol a la UI [B].** `get-session` no lo trae.

### P2 — deseable

1. **Registro de asistencia coherente [B].** `asistio` nunca se escribe.
2. **Teléfono del paciente y recordatorios por SMS o WhatsApp [B parcial + I].** Las columnas `telefono` y `telefonoVerificado` existen sin uso.
3. **Google Calendar [B parcial + I].** Las columnas existen sin uso.
4. **Datos de salud bajo la LFPDPPP.** `CLAUDE.md` declara sensibles el motivo y las notas. Ya se cumple y QA lo verificó: las notas solo llegan al personal. Hueco demostrado: borrar a un usuario con citas falla por FK. Fuera del repo [I]: solicitudes de cancelación de datos, aviso de privacidad, consentimiento y bitácora de accesos a notas.
5. **Otras prácticas generales [I].** Política de cancelación con antelación mínima, lista de espera, pagos o anticipos, historial clínico y odontograma.

## Parte 3 — Preguntas abiertas para el propietario

1. ¿La agenda del personal es un endpoint nuevo? ¿Con qué filtros: día, semana, doctor, ubicación?
2. ¿El admin gestiona agendas y citas de cualquier doctor? Hoy recibe 403 y 404.
3. ¿Quién da de alta secretarios y admins, y por qué flujo (invitación, panel)?
4. ¿Quién crea ubicaciones y tipos de consulta: el doctor, su secretario o el admin? ¿Son obligatorios para reservar?
5. ¿Puede el personal reservar en nombre de un paciente? ¿Con cuenta o como invitado?
6. Reprogramar: ¿quién puede (paciente, invitado, personal) y con qué antelación mínima? Lo mismo para cancelar.
7. ¿`completada` debe liberar el horario? ¿Se permite completada o no_show en citas futuras? ¿`asistio` se deriva del estado?
8. ¿Un doctor sin aprobar puede configurar su agenda? ¿Se rechazan bloqueos en el pasado?
9. ¿`/slots` debe usar la duración del tipo de consulta, o la manda la UI?
10. ¿Se exige verificación de correo antes de reservar o de registrarse como doctor? ¿Qué política de contraseñas y qué rate limit habrá en producción?
11. ¿Se acepta que un paciente tenga dos citas a la misma hora con doctores distintos, que un doctor se reserve a sí mismo, y que haya reservas de invitado sin límite?
12. ¿La cédula y los bloqueos (sin motivo) deben ser públicos? ¿Se normalizan correos y cédulas? ¿Se valida el formato de las cédulas SEP y del teléfono?
13. ¿Qué notificaciones se esperan además de la confirmación y los recordatorios (cancelación, cambio de estado, aviso al doctor)? ¿Solo correo, o también SMS o WhatsApp?
14. ¿Qué dominio y qué cuentas de Resend y QStash se usarán en producción? ¿Se activa Google login?
15. ¿Qué se hace con los datos de un paciente que pide borrar su cuenta si tiene citas? ¿Habrá aviso de privacidad y consentimiento en el flujo de reserva?
16. ¿Se puede revocar la aprobación de un doctor?

## Resumen

- **No hay UI.** Todo funciona solo por API. `/cita`, `/login` y `/dashboard`, a los que apuntan el correo y `proxy.ts`, no existen.
- **Reservar funciona bien**, con cuenta y como invitado: doctor, ubicación, tipo y horario, sin dobles reservas (QA: 1 de 12 gana).
- **Paciente e invitado** pueden ver, cancelar y editar el motivo. Nadie puede reprogramar.
- **Doctor y secretario** confirman, cancelan, completan y anotan citas por id, pero **no tienen listado de agenda**.
- **Agenda:** el doctor crea disponibilidad y bloqueos pero no puede editarlos ni borrarlos. El secretario no puede tocar la agenda por el bug de `relacionConDoctor`; ese bug no afecta a las citas.
- **Ubicaciones, tipos de consulta, secretarios y roles** solo se crean por SQL. El **admin** solo aprueba doctores.
- **Correo y recordatorios** están implementados pero no se verificaron de punta a punta.
- **Auth:** no hay recuperación de contraseña, verificación de correo, rate limit ni cambio de correo. Google login no se ha probado.
- **P0 para operar:** UI, agenda del personal, arreglo del secretario con gestión de roles, CRUD de ubicaciones, tipos, disponibilidad y bloqueos, `/slots` confiable, correo probado y reserva por recepción.
