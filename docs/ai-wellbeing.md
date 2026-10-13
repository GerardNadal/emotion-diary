# Fase 6: IA y bienestar bajo demanda

El detalle del diario y «Para ti» ofrecen acompañamiento GPT y tres propuestas musicales. «Para ti» añade una cita seleccionada por contexto. La sección permite elegir uno de los últimos 12 momentos; desde el historial puede elegirse cualquier otro. Abrir pantallas o cambiar la selección nunca solicita OpenAI. Los recursos generales y actividades iniciales están disponibles sin el proveedor.

En «Para ti», la selección y solicitud aparecen antes de las tres tarjetas. La respuesta actualiza esas mismas tarjetas con reflexión y acompañamiento, «Frase para ti» y tres canciones. La segunda muestra únicamente una cita y su autor, con enlace a la obra; no repite consejos ni actividades. Antes de solicitarla o si falla la consulta, se mantienen los recursos generales y una cita inicial; una alternativa local se muestra en las mismas tarjetas, indicando su procedencia. Cambiar de entrada o consentimiento descarta la respuesta anterior. El detalle de una entrada conserva su presentación compacta.

El tono transmite cercanía mediante una respuesta concreta a lo que siente la persona, sin declaraciones como «el diario te acoge» o «estoy aquí para ti». La reflexión reconoce el contexto; la segunda frase añade una perspectiva o gesto cotidiano, sin repetirlo ni atribuir causas a la emoción. Las alternativas locales siguen el mismo criterio. La versión de tono también invalida respuestas previas de la caché.

## Configuración y arquitectura

```dotenv
# Exclusivamente servidor; nunca NEXT_PUBLIC_
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
```

SDK oficial `openai` 7.32.0, Responses API, JSON Schema estricto mediante `zodTextFormat` y validación Zod adicional. GPT-4.1 mini es el modelo predeterminado para generación breve, rápida y económica. Otro modelo debe soportar Responses/Structured Outputs. `WellbeingProvider` separa proveedor y servicio; `runtime.ts` usa `server-only`; las Server Actions autorizan y conectan con Supabase. No hay Gemini ni SDK de música.

`contracts.ts` contiene contratos, `resources.ts` el catálogo y alternativas, `safety.ts` minimización/detección local, `openai-provider.ts` transporte y moderación, `service.ts` autorización/caché/cuota, y `actions.ts` integración backend. La interfaz nunca recibe claves ni importa el proveedor. Sin credenciales se devuelve una alternativa local. También hay alternativas ante errores, timeout, cuota agotada o base de datos no disponible para reservar cuota. La IA nunca modifica ni bloquea el CRUD del diario.

## Privacidad

- El cliente envía únicamente UUID de entrada y booleano de consentimiento. Se rechazan campos adicionales, prompts arbitrarios e identidades manipuladas.
- El backend exige perfil activo y relee la entrada propia con `journal_get`, cliente de sesión y RLS. Comprueba autorización antes de caché y tras la generación; descarta respuestas si la entrada cambió o se eliminó. No consulta diarios con clientes privilegiados.
- Por defecto solo se envían etiquetas del catálogo: ánimo, emoción, intensidad, categoría y motivo. Nunca UUID, fechas, datos de cuenta, equipo, empresa, apoyo recibido ni historial.
- Una casilla separada autoriza incluir reflexión, motivo personalizado, actividad preferida y reacción. El empleado confirma que no contienen identificadores. El servidor elimina correos, URL, teléfonos, UUID, números largos y palabras con mayúscula; limita cada campo a 1.200 caracteres. Esta eliminación conservadora puede quitar palabras útiles y **no garantiza anonimización**, especialmente de nombres en minúsculas o identificadores indirectos. No compartir datos personales o secretos. Revisar esta limitación antes de uso con empleados reales.
- Moderación recibe el mismo contexto reducido y revisa después la salida. El detector local analiza solo texto consentido antes de reducirlo. No se utiliza texto libre excluido por el usuario.
- `store: false`, sin conversaciones, herramientas, background, IDs de respuestas previas ni metadatos de usuario. No se persisten prompts/respuestas en PostgreSQL ni localStorage. La caché del servidor conserva solo respuestas y claves SHA-256, máximo 200 por proceso, eliminadas mediante temporizador a los 15 minutos. Su clave incluye identidad, entrada, versión y consentimiento/contexto. No hay caché compartida entre instancias; sí cuota compartida.
- Los logs solo contienen evento, modelo, duración, tokens y categoría técnica. No excepciones, errores del proveedor, IDs, contextos o recomendaciones. Un fallo sin `usage` puede tener consumo que solo aparezca en la factura. Evitar observabilidad externa que capture cuerpos de peticiones/respuestas.
- No hay entrenamiento propio, acceso administrativo a recomendaciones ni incorporación a reporting. Los clientes privilegiados de los scripts se usan exclusivamente para preparar y eliminar cuentas aisladas de prueba.

Según [OpenAI Data controls](https://developers.openai.com/api/docs/guides/your-data), los datos de API no se usan para entrenar por defecto. `store: false` evita estado de Responses, pero **no equivale a Zero Data Retention**: el control de abusos puede conservar contenido hasta 30 días, sujeto a excepciones y configuración organizativa. La interfaz informa de esta transferencia y limitación. Antes de producción, revisar DPA, residencia/procesamiento, permisos del proyecto, política de retención y elegibilidad de ZDR con la organización.

## Seguridad y recursos

Las instrucciones excluyen diagnósticos, medicación, rol terapéutico, evaluación laboral, información médica inventada, garantías psicológicas y órdenes incrustadas en el diario. Salidas incompletas, rechazos o fuera de contrato se sustituyen por recursos locales.



GPT selecciona entre siete actividades seguras y explica su encaje: pausa, pantalla, planificación, movimiento, reflexión, comunicación y desconexión. Los pasos y duración son locales; el modelo no puede generar instrucciones físicas arbitrarias. No se fuerza la respiración ni se prescriben intervenciones médicas.

`quoteId` es un enum obligatorio: GPT selecciona por contexto entre cinco extractos revisados de Epicteto, Montaigne, Dickinson, Emerson y Cervantes. El texto, autor y URL se resuelven desde `quotes.ts`; nunca proceden de texto libre generado. Las traducciones propias se indican en la tarjeta. Las fuentes son las obras enlazadas de Project Gutenberg y la edición del Quijote del Centro Virtual Cervantes. Una respuesta sin ID válido se sustituye por la alternativa local. La versión del contrato forma parte de la clave de caché. En una respuesta de crisis no se muestran citas ni música.

GPT devuelve exactamente tres títulos, artistas y motivos breves, etiquetados como **sin verificación externa**. No se asegura existencia o atribución. Los enlaces abren búsquedas YouTube con solo título/artista codificados, `noopener noreferrer`; no hay API, embeds, reproducción ni letras.

## Cuota, concurrencia, actividad y costes

`ai_reserve` valida propietario y bloquea una fila privada por usuario. Ventanas móviles: **1 solicitud/minuto, 3/hora y 10/24 horas**. Lease de 90 segundos con token aleatorio; `ai_release` solo libera el token del propio usuario. Fallos/reinicios/liberaciones no recuperan cuota consumida. Un lease huérfano expira automáticamente. Se almacenan máximo diez timestamps técnicos por perfil, sin UUID de entrada/contenido emocional, depurados al reservar y eliminados al borrar el perfil. Intentos denegados no invocan OpenAI.

Plazo compartido de **25 segundos** para moderación, Responses y posibles reintentos. `maxRetries: 0`; un reintento explícito solo ante 429/503 de Responses, espera 400 ms dentro del plazo. No se reintentan fallos de red ambiguos ni timeouts. Salida máxima **1.000 tokens**. El despliegue debe permitir al menos 30 segundos por Server Action y configurar un presupuesto global en OpenAI.

`wellbeing_complete` acepta solo IDs del catálogo y deriva identidad/día desde preferencias personales. Deduplica por usuario/día/actividad e invoca `record_journal_activity('wellbeing_completed')`. Diario, reflexiones y bienestar comparten un único día para rachas/recompensas. Solo se registra al pulsar voluntariamente «He realizado esta actividad»; leer consejos no cuenta. No admite fecha ni usuario arbitrarios. Las tablas nuevas están en `journal_private`, con RLS forzada y puente `NOLOGIN/NOBYPASSRLS` existente. Se conserva el calendario significativo, sin el consejo generado.

La [ficha oficial de GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini) indica 0,40 USD/millón de entrada y 1,60 USD/millón de salida. Una prueba sintética real midió **440 entrada + 206 salida**, aproximadamente **0,000506 USD** (0,051 céntimos de dólar), sin reintento. Es una muestra. Previsión para 1.000–2.000 de entrada y 400–1.000 de salida: aproximadamente 0,0010–0,0024 USD por generación. Moderación estándar no añade coste de tokens de generación; revisar precios/factura al cambiar modelo y considerar llamadas abortadas o reintentadas.

## Verificación y despliegue

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:db:ai:linked
npm run test:integration:ai -- --allow-remote
npm run test:integration:openai
```

Mocks del transporte SDK sin consumo: manipulación, propietario antes de caché, cambio/revocación, consentimiento/minimización, caché/expiración, simultaneidad, ausencia de clave, cuotas no disponibles, crisis, errores, timeout, rechazo/incompletitud y contrato musical. PostgreSQL/PGlite y la suite SQL alojada prueban roles/RLS, ventanas de cuota/leases, petición frente a actividad, idempotencia, rachas y recompensas. Auth/PostgREST real prueba ocho solicitudes y ocho completaciones concurrentes: una concesión y una completación. Las cuentas aisladas se eliminan al terminar; fixtures SQL se revierten.

La prueba OpenAI real utiliza solo contexto sintético, no imprime respuestas y se omite si no hay clave. Playwright/Edge en `http://127.0.0.1:3100`, 1440×1000 y 390×844, verificó SSR, Para ti vacío/poblado, consentimiento desmarcado, selección, carga/resultado GPT real, tres búsquedas musicales, caché, error de red/reintento, completar actividad, crisis y entrada ajena. La interfaz final se comprobó también en `http://127.0.0.1:3101` con la clave explícitamente vacía: alternativas locales y ayuda urgente correctas. Sin desbordamientos ni errores de aplicación; el fetch abortado deliberadamente es esperado. Browser plugin no estaba disponible; capturas/scripts están fuera del repositorio.

Verificación final: 56 pruebas automatizadas del proyecto pasan (16 específicas del servicio/SDK de IA, además de SQL/RLS), lint, tipos y build correctos, auditoría de producción sin vulnerabilidades, y ningún rastro del backend OpenAI ni coincidencia de la clave en los 33 chunks cliente inspeccionados.

La migración `20261013073336_ai_wellbeing.sql` está aplicada/registrada en Supabase vinculado y los tipos se regeneraron. No se aplicaron migraciones ajenas aparecidas durante el trabajo. Advisors no informa avisos nuevos; permanece el aviso previo de contraseñas filtradas desactivado. No se verificó SMTP. En cada despliegue configurar las variables servidor, presupuesto/tiempo de ejecución y tratamiento de datos organizativo.
