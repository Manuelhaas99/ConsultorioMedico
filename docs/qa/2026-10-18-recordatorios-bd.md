# QA recordatorios-bd — 2026-10-18

## Resumen

Se probó `POST /api/reminders` (webhook de QStash) y la base de datos de desarrollo (esquema, restricciones y migración). Unos 95 casos: 8 por HTTP, 10 de esquema zod (vía `tsx`), 10 de lógica de recordatorios contra la base (llamando a `procesarRecordatorio`, `reservarEnvio` y `liberarEnvio` directamente) y unos 65 de SQL. Datos prefijados `qa-bd-*`; se borraron al terminar con `DELETE ... WHERE` acotado.

Bugs: 0 críticos, 0 altos, 0 medios, 1 baja. Preguntas abiertas: 4.

Qué se pudo y qué no probar con las claves de QStash vacías:

| Se pudo | No se pudo |
|---|---|
| Rechazo sin cabecera `upstash-signature` (403) | Firma válida de punta a punta por HTTP, porque sin `QSTASH_*_SIGNING_KEY` no se puede firmar |
| Esquema zod del cuerpo, directo sobre `mensajeRecordatorioSchema` | Cuerpo inválido por HTTP (400): ese paso va después de la firma |
| Omisiones (inexistente, inactiva, horario cambiado, ya enviado) y concurrencia de `reservarEnvio`, llamando al servicio y al repositorio | Firma inválida con claves configuradas (403 por `SignatureError`): sin claves la ruta responde 500 |
| Migración idéntica al esquema | Envío real del correo y reversión con `liberarEnvio` ante fallo de Resend (no se llamó a Resend) |

No se tocó `.env.local` ni se inventaron claves.

## Bugs

### QA-RECORDATORIOS-BD-01 · Con firma presente pero sin claves configuradas, el webhook responde 500 con cuerpo vacío · baja
- **Endpoint / componente:** `POST /api/reminders`, `verificarFirmaQstash` (`lib/queue/firma.ts`)
- **Pasos para reproducir:**
  `curl -i -X POST localhost:3000/api/reminders -H 'upstash-signature: abc.def.ghi' -d '{}'`
- **Esperado:** error controlado en JSON `{message}` sin detalle interno. Una firma inválida debería dar 403, no un 500 sin formato.
- **Obtenido:** `HTTP/1.1 500 Internal Server Error`, sin cuerpo (ni siquiera el JSON `{message}` de `errorJson`). Con la misma cabecera, un cuerpo no JSON también da 500. Sin cabecera da 403 `{"message":"Firma inválida"}`.
- **Evidencia:** `.next/dev/logs/next-development.log`: `ConfiguracionEntornoError: Variables de entorno inválidas (qstashFirma): QSTASH_CURRENT_SIGNING_KEY: falta; QSTASH_NEXT_SIGNING_KEY: falta`. El mensaje no se filtra al cliente.
- **Causa probable:** `getReceiver()` lanza dentro de `verificarFirmaQstash`, que está fuera del `try` de `app/api/reminders/route.ts`, así que la excepción llega a Next. Es solo configuración faltante; con claves no debería ocurrir. Hipótesis, no verificada con claves reales.

## Preguntas abiertas

1. **`completada` no libera el horario.** `cita_sin_traslape_por_doctor` usa `WHERE estado <> 'cancelada'`, y `lib/citas/intervalos.ts` documenta que solo `cancelada` libera y que `no_show` sigue ocupando a propósito. El encargo esperaba que `cancelada`, `completada` y `no_show` liberaran. En la base solo libera `cancelada`; insertar una cita `pendiente` sobre una `completada` o `no_show` da `conflicting key value violates exclusion constraint`. ¿Es intencional para `completada`? Hoy no es corregible desde la UI, porque una cita `completada` es pasada. Pero ¿se puede reagendar sobre una cita pasada `completada` corregida a mano? `docs/ARCHITECTURE.md` solo dice «citas activas» sin definirlo.
2. **Reactivar una cita cancelada.** `UPDATE cita SET estado='confirmada'` sobre una cancelada cuyo horario ya tomó otra cita falla por la restricción (comportamiento correcto en la base). ¿Qué código HTTP y mensaje debe dar el servicio, 409 `HORARIO_OCUPADO`? No hay endpoint de reactivación que probar.
3. **`disponibilidad_doctor` acepta filas duplicadas o traslapadas** (mismo doctor, día, `09:00-10:00` insertado dos veces). El esquema no tiene `UNIQUE` ni exclusión. ¿La API debe impedirlo en el servicio, o se permite? El doc no lo define.
4. **Entradas del webhook con campos extra** (p. ej. `email`) se aceptan y se ignoran (zod `object` no estricto). `ARCHITECTURE.md` dice que el mensaje «nunca lleva el correo», pero no si un campo extra debe rechazarse. ¿Basta con ignorarlo?

## Muestras de requests

### HTTP: `POST /api/reminders`

```
$ curl -s -i -X POST localhost:3000/api/reminders -H 'content-type: application/json' \
    -d '{"citaId":"11111111-1111-4111-8111-111111111111","tipo":"24h","fechaInicio":"2030-01-01T10:00:00Z"}'
HTTP/1.1 403 Forbidden
{"message":"Firma inválida"}                         # sin firma

$ curl -s -i -X POST localhost:3000/api/reminders            # sin cuerpo ni firma
HTTP/1.1 403 Forbidden
{"message":"Firma inválida"}

$ curl -s -i localhost:3000/api/reminders                    # GET
HTTP/1.1 405 Method Not Allowed

$ curl -s -i -X POST localhost:3000/api/reminders -H 'upstash-signature: abc.def.ghi' -d '{}'
HTTP/1.1 500 Internal Server Error                   # cuerpo vacío (QA-RECORDATORIOS-BD-01)
```

### Esquema zod (`mensajeRecordatorioSchema`, script con `tsx`)

```
ok           OK   {"citaId":"1111...","tipo":"24h","fechaInicio":"2030-01-01T10:00:00.000Z"}
offset       OK   fechaInicio "2030-01-01T10:00:00-06:00" -> 2030-01-01T16:00:00.000Z
sin zona     FAIL fechaInicio:invalid_format
tipo malo    FAIL tipo:invalid_value  ("2h")
uuid malo    FAIL citaId:invalid_format
falta campos FAIL tipo:invalid_value, fechaInicio:invalid_type
extra email  OK   (el campo extra se descarta)
array / null FAIL invalid_type
2030-02-31   FAIL fechaInicio:invalid_format
```

### Lógica de recordatorios contra la base (`tsx --conditions=react-server`)

```
inexistente          {"enviado":false,"motivo":"NO_ENCONTRADA"}
cancelada            {"enviado":false,"motivo":"CITA_INACTIVA"}
completada           {"enviado":false,"motivo":"CITA_INACTIVA"}
no_show              {"enviado":false,"motivo":"CITA_INACTIVA"}
horario cambiado     {"enviado":false,"motivo":"HORARIO_CAMBIADO"}      (también con diferencia de 1 ms)
ya enviado 24h       {"enviado":false,"motivo":"YA_ENVIADO"}
reservarEnvio x10 concurrentes: ganadores = 1
reservarEnvio de nuevo: false | tras liberarEnvio: true
reservarEnvio sobre cancelada: false | con horario distinto: false
```

### SQL (`docker compose exec -T db psql -U citas -d citas -c "<sentencia>"`)

Datos base: doctor `bbbbbbbb-...0001` (cédula `qa-bd-ced1`), segundo doctor `c9d53a4b-...`, pacientes y usuarios `qa-bd-*`.

UNIQUE
```
INSERT INTO doctor(usuario_id,especialidad_id,cedula) VALUES ('qa-bd-u2',...,'qa-bd-ced1');
ERROR:  duplicate key value violates unique constraint "doctor_cedula_unique"
INSERT INTO doctor(usuario_id,especialidad_id,cedula) VALUES ('qa-bd-u1',...,'qa-bd-ced2');
ERROR:  duplicate key value violates unique constraint "doctor_usuario_id_unique"
INSERT INTO usuario(id,name,email) VALUES ('qa-bd-u4','x','qa-bd-1@example.com');
ERROR:  duplicate key value violates unique constraint "usuario_email_unique"
INSERT INTO especialidad(nombre) VALUES ('qa-bd-esp');            -- repetido
ERROR:  duplicate key value violates unique constraint "especialidad_nombre_unique"
INSERT INTO cita(... token_gestion_hash) VALUES (... 'aaaa...a' x64);   -- segundo con el mismo hash
ERROR:  duplicate key value violates unique constraint "cita_token_gestion_hash_unique"
INSERT INTO cita(...,token_gestion_hash) VALUES (...NULL),(...NULL);
INSERT 0 2                                                          -- varios NULL permitidos
```

CHECK
```
INSERT INTO cita(...,fecha_inicio,fecha_fin) VALUES (...,'2031-03-01 11:00+00','2031-03-01 10:00+00');   ERROR: violates check constraint "cita_fechas_validas"
   (fin = inicio: mismo error)
INSERT INTO cita(doctor_id,fecha_inicio,fecha_fin) VALUES (...)  -- sin paciente ni invitado   ERROR: "cita_paciente_o_invitado"
   (invitado sin email, con email '', con nombre '': mismo error)
token_gestion_hash 'abc', 64 'A' mayúsculas, 65 'a', 64 'g', 63 'a' + salto de línea:   ERROR: "cita_token_gestion_hash_formato"
token_gestion_hash 64 'a':   INSERT 0 1
INSERT INTO tipo_consulta(...,duracion_minutos) VALUES (...,0) y (...,-5):  ERROR: "tipo_consulta_duracion_positiva"
INSERT INTO disponibilidad_doctor(...,'10:00','09:00') y ('10:00','10:00'):  ERROR: "disponibilidad_doctor_horas_validas"
INSERT INTO bloqueo_horario(...) fin = inicio y fin < inicio:  ERROR: "bloqueo_horario_fechas_validas"
```

Enums
```
INSERT INTO usuario(id,name,email,rol) VALUES (...,'dentista');   ERROR: invalid input value for enum rol: "dentista"
INSERT INTO disponibilidad_doctor(...,'funday',...);              ERROR: invalid input value for enum dia_semana: "funday"
INSERT INTO cita(...,estado) VALUES (...,'reprogramada');         ERROR: invalid input value for enum estado_cita: "reprogramada"
```

Llaves foráneas (insertar con referencia inexistente)
```
doctor.usuario_id 'qa-bd-nope'        ERROR: violates foreign key constraint "doctor_usuario_id_usuario_id_fk"
cita.paciente_id 'qa-bd-nope'         ERROR: "cita_paciente_id_usuario_id_fk"
cita.doctor_id inexistente            ERROR: "cita_doctor_id_doctor_id_fk"
cita.tipo_consulta_id inexistente     ERROR: "cita_tipo_consulta_id_tipo_consulta_id_fk"
cita.ubicacion_id inexistente         ERROR: "cita_ubicacion_id_ubicacion_id_fk"
```

ON DELETE (con un doctor con ubicación, tipo de consulta, disponibilidad, bloqueo, secretario, sesión y cuenta)
```
DELETE FROM doctor WHERE id='...0006';        ERROR: ... "cita_doctor_id_doctor_id_fk" (NO ACTION con cita)
DELETE FROM ubicacion WHERE id='...0006';     ERROR: "cita_ubicacion_id_ubicacion_id_fk"
DELETE FROM usuario WHERE id='qa-bd-u5';      ERROR: "cita_paciente_id_usuario_id_fk"
DELETE FROM usuario WHERE id='qa-bd-u6';      ERROR: "cita_doctor_id_doctor_id_fk" (el cascade usuario->doctor choca con la cita)
DELETE FROM especialidad WHERE id='...';      ERROR: "doctor_especialidad_id_especialidad_id_fk"
-- tras borrar la cita de prueba:
DELETE FROM usuario WHERE id='qa-bd-u5';      DELETE 1
SELECT count(*) de doctor, ubicacion, tipo_consulta, disponibilidad_doctor, bloqueo_horario, secretario, session, account de ese usuario/doctor:  0 en todas (cascade correcto)
```

Exclusión `cita_sin_traslape_por_doctor` (doctor D, 2031-04-01 salvo indicación)
```
base 10:00-11:00 pendiente                       INSERT 0 1
10:30-11:30 pendiente                            ERROR: conflicting key value violates exclusion constraint
10:00-11:00 confirmada (idéntico)                ERROR
10:15-10:45 (contenido)                          ERROR
09:00-12:00 (contiene)                           ERROR
11:00-12:00 (contiguo)                           INSERT 0 1
09:00-10:00 (contiguo)                           INSERT 0 1
otro doctor, 10:00-11:00                         INSERT 0 1
UPDATE ... estado='cancelada' sobre la base      UPDATE 1; luego otra pendiente 10:00-11:00: INSERT 0 1
INSERT con estado 'cancelada' sobre el mismo horario    INSERT 0 1
UPDATE ... estado='confirmada' en la cancelada (hay otra activa)    ERROR
UPDATE de fecha de la cita 11:00-12:00 a 10:00-11:00 (choca)        ERROR
completada 04-02 10-11, luego pendiente mismo horario     ERROR (completada ocupa)  <- pregunta 1
no_show 04-03 10-11, luego pendiente mismo horario        ERROR (no_show ocupa)
'2031-04-05 04:00-06' (=10:00Z) y luego '2031-04-05 10:00+00'    segunda ERROR (compara instantes)
Concurrencia: 6 psql en paralelo con el mismo doctor y horario    1 INSERT 0 1, 5 ERROR; count(*) = 1
```

Migración frente al esquema
```
CREATE DATABASE qa_bd_scratch; se aplicó 0000_inicial.sql con ON_ERROR_STOP=1 (sin errores)
\d+ de las 12 tablas en `citas` vs `qa_bd_scratch`: diff vacío (idénticas)
pnpm exec drizzle-kit generate (a una copia temporal de las migraciones): "No schema changes, nothing to migrate"
\d+ cita muestra "cita_sin_traslape_por_doctor" EXCLUDE USING gist (doctor_id WITH =, tstzrange(fecha_inicio, fecha_fin, '[)') WITH &&) WHERE (estado <> 'cancelada')
SELECT extname FROM pg_extension -> plpgsql, btree_gist
DROP DATABASE qa_bd_scratch (la base temporal creada por mí)
```

## Casos que pasaron

- `POST /api/reminders` sin firma, sin cuerpo y con cuerpo válido pero sin firma: 403 `Firma inválida`. GET: 405.
- Esquema zod: rechaza fecha sin zona, tipo fuera de `24h|1h`, UUID inválido, campos faltantes, `null` o arreglo, fecha imposible. Acepta `offset` y normaliza a UTC.
- `procesarRecordatorio`: omite citas inexistentes, canceladas, completadas, `no_show`, con horario distinto (incluso 1 ms) o ya enviadas, sin llegar a enviar correo ni modificar banderas.
- `reservarEnvio`: con 10 llamadas concurrentes solo una gana. No reserva sobre citas canceladas ni con horario distinto. `liberarEnvio` permite reintentar.
- CHECK: `cita_fechas_validas`, `cita_paciente_o_invitado` (nulos y cadenas vacías), `cita_token_gestion_hash_formato` (longitud, mayúsculas, no hex, salto de línea), `tipo_consulta_duracion_positiva`, `disponibilidad_doctor_horas_validas`, `bloqueo_horario_fechas_validas`.
- UNIQUE: cédula, usuario del doctor, correo de usuario, nombre de especialidad, hash de token. Los NULL repetidos del token se permiten.
- Enums `rol`, `dia_semana`, `estado_cita`: rechazan valores desconocidos.
- Llaves foráneas y ON DELETE (cascade y NO ACTION) según `schema.ts`.
- Exclusión: traslape parcial, contenido, contenedor, idéntico, entre estados activos, por UPDATE y concurrente; contiguos y otro doctor permitidos; `cancelada` libera el horario; compara instantes sin importar la zona.
- `0000_inicial.sql` coincide con la base y con `schema.ts` (sin cambios pendientes en drizzle-kit).
- No se encontraron fugas de datos: el único error interno (claves faltantes) no llega al cliente.
