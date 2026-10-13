# Fase 5: publicaciones colectivas

## Contrato y acceso

`public.collective_statistics(p_team_id uuid, p_period date, p_grain text)` devuelve un único JSON agregado. `p_period` es el primer día de un mes cerrado o trimestre natural cerrado en Europe/Madrid; ventana de selección: 24 meses. No hay filtros por persona, emoción, motivo, fecha libre, día ni hora. Un administrador de equipo debe indicar exactamente uno de sus equipos asignados. Solo el administrador de empresa puede usar `null` para el resumen. La identidad, perfil activo, rol y asignación se comprueban en PostgreSQL en cada llamada; el JWT no decide el rol.

El frontend utiliza el cliente de sesión con clave publicable. La función pública es SECURITY INVOKER; delega en `reporting.dashboard`, SECURITY DEFINER, cuyo propietario es `dentro_reporting_executor` (NOLOGIN, NOINHERIT, NOBYPASSRLS). Este rol solo puede leer las columnas estructuradas necesarias del diario, sin reflexión, UUID de entrada ni textos libres; tampoco puede leer nombres ni correos de empleados en el directorio. RLS del diario personal permanece intacta; una política SELECT exclusiva para el rol interno permite el cálculo colectivo. Las funciones auxiliares no tienen EXECUTE para roles de aplicación. Las tablas de reporting tienen RLS y carecen de permisos de aplicación incluso si se expusiera ese esquema accidentalmente en PostgREST. El gateway privado aplica la misma autorización si se invoca directamente desde SQL. Ni anon ni service_role pueden ejecutar la RPC. La segunda migración reduce los permisos por columna del directorio y elimina EXECUTE público predeterminado para futuras funciones de reporting.

No se publican identificadores de personas, emails, nombres personales, textos libres, cantidades de entradas, días activos ni participantes exactos. Nombres e identificadores de equipos proceden del directorio autorizado y sirven exclusivamente para elegir equipos; el JSON de estadísticas solo identifica los equipos comparados por su nombre.

## Metodología

Los participantes son empleados activos con al menos una entrada válida en el mes. Los administradores conservan su propio diario y estadísticas personales; sus entradas no se asignan artificialmente a equipos que administran.

1. En cada dimensión, se calcula la proporción de categorías dentro de las entradas de cada participante y día local.
2. Se promedian esas proporciones sobre los días activos de cada participante. Los días sin entradas no son ceros.
3. Se promedian los participantes con pesos iguales. Tener 6.000 entradas no aumenta el peso del empleado.
4. Las proporciones publicadas se redondean a múltiplos de 10 puntos porcentuales, sin ajuste residual para sumar 100. No se ofrece una media exacta adicional.

Se distinguen internamente participantes, días activos y entradas; no se publican sus recuentos por riesgo de reconstrucción. La participación es participantes/plantilla activa estable, redondeada, solo si tanto participantes como no participantes alcanzan el umbral. Los motivos y factores laborales utilizan únicamente el catálogo de trabajo, relaciones laborales, carrera y conciliación. Todo lo demás se reúne bajo `unreported`: no se clasifican factores privados ni se incluyen motivos personalizados. El ánimo favorable se deriva de las mismas barras publicadas, nunca de otra consulta exacta. Las tendencias son descriptivas, sin causalidad, diagnóstico o clasificación de desempeño.

## Cohortes y traslados

`reporting.team_state` guarda el inicio y generación de la composición estable, desde la aplicación de esta migración. Un alta, baja, traslado, activación/desactivación o cambio de rol de un empleado inicia una nueva generación para ambos equipos afectados y retira sus publicaciones anteriores. Cambiar un nombre o email no altera la cohorte. La nueva cohorte solo permite meses que comiencen después del cambio y de la línea base global. No se intenta reconstruir la composición anterior sin evidencia, ni se reasignan entradas antiguas al nuevo equipo.

Consecuencia deliberada: al aplicar la fase el 13 de octubre de 2026, el primer mes potencialmente publicable es noviembre, una vez cerrado el 1 de diciembre y siempre que la composición permanezca estable y cumpla los controles. El primer trimestre potencial es enero–marzo de 2027. Los históricos previos muestran datos insuficientes. No se debe adelantar la línea base en un entorno con datos reales. Las pruebas usan procedencia ficticia explícita dentro de una transacción que se revierte.

## Política de privacidad verificable

- Umbral inicial de 3 participantes reales, configurable hacia arriba en `reporting.policy.min_participants` por una migración/operación SQL privilegiada. No hay RPC para reducirlo.
- Cada categoría presente y su complemento deben tener al menos k participantes. Una sola categoría insegura suprime toda la dimensión, sin restos, totales ni porcentajes parciales. La unanimidad también se suprime. Esto hace que ciertas distribuciones necesiten al menos 6 participantes aunque el umbral del conjunto sea 3.
- No se publican conjuntos que difieran de otra publicación mensual de la misma generación por entre 1 y k−1 participantes en cualquiera de las dos direcciones. La comprobación incluye conjuntos retirados y conjuntos suficientes que se hayan suprimido por diferencias, para no habilitar ataques cambiando el orden de consultas.
- Cada equipo/mes tiene una única publicación persistente, incluida la insuficiencia de datos. Las peticiones sucesivas reutilizan ese JSON. Un bloqueo transaccional serializa publicaciones y mutaciones relevantes.
- Insertar, editar o eliminar una entrada de un mes ya publicado retira definitivamente la publicación afectada; conserva la clave y el conjunto interno como evidencia. No se publica una segunda versión numérica. La retirada también protege trimestres y comparaciones. Cambiar la política retira las publicaciones existentes.
- Los trimestres se calculan exclusivamente como la media de tres publicaciones mensuales, sin consultar de nuevo los diarios ni rescatar dimensiones suprimidas.
- El resumen de empresa incluye solo equipos con publicaciones disponibles y da el mismo peso a cada equipo. Si alguna dimensión de uno de esos equipos está protegida, también se protege esa dimensión de empresa. No representa toda la plantilla cuando hay exclusiones. Los equipos pequeños no aportan ni a distribuciones ni a participación ni a un denominador oculto. La empresa y los trimestres son solo operaciones sobre información ya publicable.
- Estado de protección uniforme: `{ "status": "insufficient_data" }`, sin números, motivos concretos ni metadatos del conjunto suprimido.

Esta política limita las consultas disponibles, las diferencias y las categorías pequeñas. **No es privacidad diferencial ni una garantía matemática frente a todo conocimiento externo o colusión**: el umbral y el redondeo no proporcionan esa propiedad. Para ampliar filtros, granularidad o alcance haría falta rediseñar el mecanismo de publicación con garantías formales, no simplemente añadir consultas SQL.

## Rendimiento y operación

Índice por `(occurred_at,user_id)` y el índice existente por propietario/fecha permiten acotar los meses. Los cálculos ocurren en PostgreSQL; Next.js recibe solo publicaciones. Las consultas posteriores reutilizan publicaciones; seis períodos fijos evitan históricos ilimitados. El bloqueo global es conservador y adecuado para la demo; puede limitar la concurrencia de escritura en una empresa grande. No hay scheduler ni service_role de reporting: la primera consulta autorizada fija el mes. El frontend no conserva agregados entre usuarios ni usa caché compartida.

La retirada permanente es el coste de proteger comparaciones antes/después. Ediciones anteriores a la primera publicación se incorporan normalmente; posteriores retiran el resultado. Una publicación insuficiente no se reabre con nuevas entradas históricas. Esto debe explicarse al operar una demo, sin relajar la política de producción.

## Validación reproducible

- `npm test`: PostgreSQL real embebido (PGlite), con Auth emulado; incluye `supabase/tests/reporting.sql` además de las pruebas previas.
- `npm run test:db:reporting:linked`: las mismas aserciones SQL en PostgreSQL del Supabase vinculado, con fixtures y cambios dentro de BEGIN/ROLLBACK. No deja usuarios, diarios, políticas alteradas ni publicaciones de prueba.
- `npm run test:integration:reporting -- --allow-remote`: Auth y PostgREST reales; crea y elimina identidades aisladas. El cliente privilegiado solo aprovisiona y limpia fixtures, nunca lee diarios ni calcula estadísticas. Prueba denegaciones, estados insuficientes, firmas manipuladas, diario privado y revocación con JWT vigente. Las publicaciones con valores se prueban en la suite SQL transaccional porque no se falsifica la trazabilidad de producción.
- SQL cubre empleados, administradores autorizados/no asignados, anon, inactive/orphan, cambios de asignación, columnas privadas, grupos vacíos/pequeños, categorías y complementos, empresa frente a grupos pequeños, peso de 6.000 entradas, promedios por día, participación, meses/trimestres, conjuntos sucesivos, edición, borrado, entrada retroactiva, traslados y desactivación.
- Verificación de interfaz: inicio de empresa/equipo y `/admin/insights`, selección de equipo y período, detalles, errores/carga y layout móvil. Las capturas con datos ficticios de QA deben identificarse como pruebas y nunca presentarse como resultados reales de empresa.

Referencias técnicas consultadas: [funciones y permisos](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Resultado de la verificación del 13 de octubre de 2026

Ambas migraciones están aplicadas al proyecto vinculado. Pasan las 39 pruebas automatizadas, lint, tipos y build; también las suites SQL alojadas de diario, evolución y reporting, y Auth/PostgREST de reporting/evolución. Los fixtures se eliminaron o revirtieron. Advisors no presenta avisos de rendimiento ni avisos nuevos de seguridad; permanece el aviso de protección de contraseñas filtradas de Auth desactivada, previo a esta fase.

QA usa Playwright/Edge porque el plugin Browser no está disponible. Sitio real: http://127.0.0.1:3000; viewports 1440×1000 y 390×844. Comprueba identidad y contenido, ausencia de overlay/errores de aplicación, SSR de empresa/equipo, opciones autorizadas, meses/trimestres, detalles, fallo de red y reintento, redirección de empleados y ausencia de desbordamiento. El único error de consola esperado corresponde al fallo de red provocado. Los gráficos poblados se verificaron con los fixtures SQL ficticios en un montaje externo claramente identificado como QA, sin falsear la procedencia de producción. No se presenta esa prueba como un historial real ya publicable. Capturas y scripts permanecen fuera del repositorio.
