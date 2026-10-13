# Evolución personal · Fase 4

La pantalla `/insights` y el resumen personal de `/employee` y `/journal` usan datos reales del usuario activo. Los administradores consultan su espacio personal en `/journal`; sus dashboards administrativos siguen separados. No hay rankings, puntuaciones laborales ni comparaciones individuales.

## Cálculos

| Concepto | Regla |
| --- | --- |
| Entradas | Todas las entradas cuya `occurred_at` cae en el período local, incluidos varios registros en un día. |
| Días con registros | Fechas locales distintas con al menos una entrada. No son días de actividad de la racha. |
| Ánimo diario | Media orientativa de la escala ordinal: muy mal = 1, mal = 2, neutral = 3, bien = 4, muy bien = 5. No es una medida clínica. |
| Intensidad diaria | Media de la intensidad 1–5 registrada, independiente del ánimo y la emoción. Una emoción agradable puede ser intensa. |
| Medias del período | Media de las medias diarias; cada día registrado tiene el mismo peso. Redondeo a dos decimales únicamente al devolver el resultado. |
| Distribuciones | Frecuencia por entrada de cinco ánimos, nueve emociones y cinco intensidades. Las emociones se ordenan por frecuencia; se muestran los empates. Los porcentajes redondeados pueden no sumar exactamente 100%. |
| Motivos | Ocho combinaciones más frecuentes de categoría, motivo del catálogo y texto personalizado. No se deducen causas; se informa también del número de entradas sin motivo. |
| Comparación | Período inmediatamente anterior de igual número de fechas locales. Las distribuciones muestran también el porcentaje anterior. No se compara con otras personas. |
| Descripción de cambio | Solo con al menos tres días registrados en ambos períodos. Diferencia de ánimo medio de menos de 0,25 se describe como parecida; en otro caso, más alta/baja. Umbral editorial, sin significación estadística ni diagnóstico. |
| Días vacíos | Conteo cero, medias `null`; huecos en gráficos. Nunca se sustituyen por neutral, intensidad cero o valores interpolados. |

Se ofrecen ventanas móviles inclusivas de 7, 30 y 90 días hasta hoy en la zona guardada, y períodos personalizados de hasta 366 días. La comparación puede ser parcial si hay pocos registros anteriores; los conteos lo hacen visible. Ediciones y borrados se reflejan en la siguiente consulta porque las métricas se calculan sobre las entradas actuales.

## Calendarios y zona horaria

`journal_preferences` inicializa una zona IANA desde el primer dispositivo, conservándola en PostgreSQL entre sesiones y dispositivos. La API directa usa UTC si todavía no existe preferencia. El formulario inicializa la zona antes de guardar una entrada. Un segundo dispositivo no cambia la preferencia automáticamente. Se puede cambiar explícitamente en «Mi evolución»; PostgreSQL valida la zona.

Los límites de consulta convierten **cada medianoche local** a `timestamptz`. El límite superior es la medianoche posterior, exclusiva; no se suman 24 horas al límite inicial. Así se incluyen días de 23/25 horas durante los cambios de horario.

El calendario emocional muestra todos los ánimos distintos del día con sus iconos y el número total de entradas; su etiqueta accesible incluye también todas las emociones. No elige una emoción predominante ocultando las demás. Al seleccionar un día abre el historial filtrado en la zona guardada; mantiene páginas de 12 entradas, acceso al detalle y edición/borrado existentes. La navegación mensual y la cuadrícula se reutilizan en el calendario de actividad.

Cambiar la zona reagrupa los momentos emocionales. Los días de actividad pasados conservan la fecha y zona que tenían cuando se realizaron; los nuevos usan la preferencia actual. Esto evita reescribir recompensas al viajar. Cerca de la línea internacional de fecha, una acción puede caer en una fecha anterior o posterior a la última registrada: la unicidad por fecha y el cálculo por secuencias ordenadas siguen aplicándose.

## Actividad, rachas y recompensas

Un trigger transaccional sobre entradas es la única fuente actual de actividad:

- Una inserción real registra `entry_created`; el reintento idempotente por UUID no dispara otra inserción.
- Una reflexión pasa de vacía a texto no vacío por primera vez y registra `reflection_completed`. `reflection_completions` impide generar nuevos días vaciando y volviendo a completar esa misma reflexión. Las reflexiones existentes se marcan como ya completadas al migrar.
- Cambios de ánimo, fecha, intensidad, navegación, login, lecturas y guardados sin cambios no generan actividad. Completar una reflexión en la creación no genera un segundo día.

`record_journal_activity` toma el reloj real de PostgreSQL y la zona guardada; nunca acepta una fecha del cliente. Guardar un momento antiguo cuenta hoy. `activity_days` conserva como máximo una fila por propietario y fecha, con la primera clase de acción y su instante; no registra sesiones, clics ni todas las acciones del día. Se bloquea la preferencia del propietario para serializar acciones concurrentes y cambios de zona.

Las rachas se calculan con islas de fechas consecutivas (`day - row_number`). La racha actual incluye la secuencia que llega a hoy o ayer; si ayer fue el último día, aún se puede continuar hoy. Cuando ni hoy ni ayer tienen actividad, es cero. El récord es la secuencia más larga del historial de actividad. El cálculo se ejecuta en PostgreSQL sobre **una fila por día**, no sobre todo el diario ni en el navegador.

Al insertar un nuevo día, se conceden hitos de 1, 5, 10 y 30 días según el récord alcanzado, con clave única `(user_id,milestone)`. El reconocimiento y su fecha se conservan tras pausas o eliminación de entradas: reflejan acciones que se realizaron, no el volumen actual del diario. No existen penalizaciones ni notificaciones de culpa.

**No se reconstruyen rachas anteriores a esta migración.** La fase 3 no guardaba la zona personal usada en cada acción; reconstruirlas desde `occurred_at` inventaría actividad retroactiva. Las estadísticas sí incluyen todo el historial real disponible. Se informa de este inicio en la interfaz.

Para incorporar recursos o IA en otra fase, ampliar el catálogo de acciones válidas y llamar a `app_private.record_journal_activity` desde su mutación de base de datos verificada, después de comprobar una finalización real. No crear un endpoint público que permita reclamar actividad o recompensas por un clic. La función interna no es ejecutable por roles de aplicación.

## Consultas, privacidad y crecimiento

La migración `20261013004038_personal_evolution.sql` añade `preferences`, `activity_days`, `reflection_completions` y `rewards` a `journal_private`. Todas tienen RLS forzada por propietario activo, sin excepción para los administradores, y no son accesibles a `anon`, `authenticated` ni `service_role`. Sus claves/índices empiezan por propietario, incluido el índice de las finalizaciones por usuario.

Las RPC públicas `journal_statistics`, `journal_progress` y `journal_preferences` son `SECURITY INVOKER` y delegan en el ejecutor existente `NOLOGIN/NOBYPASSRLS`. No se usa el cliente privilegiado ni funciones de `postgres` para leer datos personales. La identidad procede del puente existente `journal_uid`, que solo obtiene el UUID autenticado y no lee el diario. Las Server Actions comprueban la sesión y validan parámetros estrictos; ninguna RPC nueva acepta un UUID de otra persona. Desactivar un perfil bloquea también las consultas nuevas.

`journal_statistics` usa el índice existente `(user_id,occurred_at,id)` con límites UTC indexables antes de agrupar. Lee solo columnas de métricas y motivos, sin reflexiones, reacciones ni apoyo. Un CTE materializado comparte la ventana actual/anterior entre las agrupaciones. La respuesta tiene como máximo 366 fechas, 38 filas de distribución por dos períodos y ocho motivos, con independencia del número de entradas. `journal_days` se limita al mes y devuelve cinco ánimos y nueve emociones distintos como máximo por día; el detalle mantiene paginación. No se descarga el historial completo.

No hay caché compartida de datos personales. Los guardados y borrados invalidan el inicio, el diario y `/insights`. Los datos se consultan de nuevo al entrar en esas pantallas, cambiar de período o reintentar. No hay escucha Realtime ni actualización instantánea de una pestaña que permanece abierta mientras se edita desde otro dispositivo; recargar vuelve a consultar los datos persistidos.

## Validación reproducible

```powershell
npm run lint
npm run typecheck
npm test
npm run build
supabase db query --linked --file supabase/tests/journal.sql
npm run test:db:evolution:linked
npm run test:integration -- --allow-remote
npm run test:integration:evolution -- --allow-remote
supabase db advisors --linked --type all --level warn --fail-on error
```

Los tests SQL se ejecutan tanto en PGlite como en Supabase real, con rollback de los fixtures. Cubren registros múltiples, medias con peso diario, vacíos, ediciones/borrados, nueve emociones, fechas, DST de primavera/otoño, meses/años, rachas actuales/interrumpidas/expiradas, récords, reflexiones no repetibles, hitos únicos, 10.000 entradas y aislamiento entre propietarios/ambos administradores/anon/service_role/perfiles desactivados. PGlite retira al ejecutor acceso al esquema `auth`, reproduciendo la restricción del Supabase alojado.

El test de integración usa Auth y PostgREST reales, prueba reintentos concurrentes y una segunda sesión del propietario con otra zona del dispositivo. El cliente privilegiado prepara y elimina exclusivamente identidades temporales; todas las operaciones emocionales usan la sesión real y clave pública. Los datos de prueba se eliminan al terminar.

La revisión de interfaz usa Playwright/Edge en `http://localhost:3100/insights`, escritorio 1440×1000 y móvil 390×844, con cuentas temporales. El plugin Browser no estaba disponible; se utilizó el Playwright incluido en el runtime. Las capturas y el script de revisión permanecen fuera del repositorio.

Próxima fase: integrar únicamente acciones de bienestar realmente implementadas y desarrollar los agregados anónimos administrativos como API separada con sus umbrales de privacidad. SMTP/recuperación por correo y protección de contraseñas filtradas en Auth continúan siendo tareas de configuración anteriores a esta fase.
