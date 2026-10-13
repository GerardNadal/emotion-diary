# Dentro · Diario emocional

Aplicación interna para una única empresa. Implementa autenticación, directorio, equipos, responsables y permisos para los tres roles. La fase 3 conecta el diario privado a Supabase: registro, revisión, edición, borrado individual/múltiple, historial paginado, filtros y calendario. La fase 4 añade estadísticas personales agregadas en PostgreSQL, gráficos de ánimo/intensidad, distribución de nueve emociones y motivos, comparación de períodos, calendario con varios ánimos, rachas persistentes y recompensas privadas. El inicio muestra un resumen emocional reciente, racha y actividad semanal.

Consulta las pantallas y los puntos de integración en [docs/interfaces.md](docs/interfaces.md).

Consulta las decisiones y el modelo de autorización en [docs/architecture.md](docs/architecture.md).

Consulta las fórmulas, reglas de rachas, zona horaria, consultas y pruebas de la fase 4 en [docs/personal-evolution.md](docs/personal-evolution.md).

## Requisitos

- Node.js 22.16 o superior (verificado con 26.7), npm y el lockfile incluido.
- Supabase CLI en PATH (comandos verificados con 2.116; se recomienda una versión actual).
- Docker Desktop arrancado para Supabase local, o un proyecto Supabase exclusivo de demostración.
- SMTP configurado para correos reales; en local se utiliza Mailpit.

## Instalación local

```powershell
npm ci
Copy-Item .env.example .env.local
npm run db:start
npm run db:migrate
```

Supabase CLI informa de las URL y claves del entorno local. Completa `.env.local`:

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL de la API del proyecto, por ejemplo `http://127.0.0.1:54321` en local |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key; el `anon` JWT local también es compatible |
| `SUPABASE_SECRET_KEY` | Secret key o `service_role` local, solo servidor/scripts |
| `APP_URL` | Origen canónico de Next.js, inicialmente `http://localhost:3000` |

La clave secreta no puede llevar prefijo `NEXT_PUBLIC_`. No se debe compartir con los administradores o empleados de la aplicación, guardar en Git ni imprimir en logs.

```powershell
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Sin las variables públicas, `/login` muestra configuración pendiente y no permite iniciar sesión. Las rutas privadas redirigen al login. Para producción, las variables públicas se proporcionan **antes del build**: cambiar las variables públicas exige recompilar.

La configuración local desactiva registro, acceso anónimo y semillas automáticas. Solo `public` está expuesto en la API; no añadas `app_private`, `journal_private` ni `reporting` a los esquemas expuestos. No uses `db reset` sobre datos que quieras conservar: borra el entorno local.

## Administrador inicial

Define temporalmente estas variables en `.env.local` o en el entorno del proceso:

```dotenv
BOOTSTRAP_EMAIL=tu-correo-de-administracion
BOOTSTRAP_NAME=Nombre del administrador
BOOTSTRAP_PASSWORD=una-contraseña-propia-de-al-menos-12-caracteres
```

Son marcadores: usa un correo válido y una contraseña elegida por ti. El script no imprime contraseñas, no sobrescribe cuentas y solo inicializa una vez. La RPC correspondiente es inaccesible a usuarios normales y protege la inicialización concurrente.

```powershell
npm run auth:bootstrap
```

Elimina `BOOTSTRAP_PASSWORD` del archivo/entorno después. Inicia sesión con las credenciales proporcionadas. Los administradores adicionales se crean desde «Personas». No hay contraseñas por defecto.

Si una operación falla entre Auth y PostgreSQL se intenta compensar la cuenta creada. Si aparece «Reconciliación necesaria», revisa el UUID en Auth y `profiles`: elimina únicamente una cuenta huérfana recién creada, sin perfil; nunca borres una cuenta existente para reintentar.

## Datos ficticios

Después del bootstrap define `DEMO_PASSWORD` con al menos 12 caracteres y ejecuta:

```powershell
npm run demo:seed
```

| Cuenta ficticia | Rol | Alcance |
| --- | --- | --- |
| `empresa@example.test` | Empresa | Toda la demo |
| `responsable@example.test` | Equipo | Demo · Desarrollo y Demo · Producto |
| `responsable.operaciones@example.test` | Equipo | Demo · Operaciones y Demo · Soporte |
| `responsable.marketing@example.test` | Equipo | Demo · Marketing |
| `responsable.personas@example.test` | Equipo | Demo · Personas |
| `desarrollo@example.test` | Empleado | Demo · Desarrollo |
| `operaciones@example.test` | Empleado | Demo · Operaciones |

La demo incluye **6 equipos, 60 empleados (54 activos y 6 inactivos), 4 responsables y 1 administrador de empresa**. Cada equipo tiene 10 empleados; la cuenta terminada en `.10@example.test` está inactiva. Las cuentas nuevas siguen el patrón `demo.producto.01@example.test`, `demo.soporte.01@example.test`, etc.; Desarrollo y Operaciones conservan sus empleados originales y añaden las cuentas `.02` a `.10`. Así se pueden explorar varias páginas del directorio, gestionar asignaciones y comparar los recuentos de empleados totales y activos.

También genera alrededor de **8.500 entradas emocionales durante los últimos 180 días completos**, hasta ayer en Europe/Madrid, para las 59 cuentas activas, incluidos los administradores en su espacio personal. Hay días sin registro, días con dos entradas, todos los estados de ánimo, emociones e intensidades, factores laborales y personales, motivos personalizados y reflexiones completas o pendientes. Los equipos tienen distintas tasas de participación y distribuciones de ánimo. Las cuentas inactivas no reciben entradas.

Usan la contraseña que proporcionaste en `DEMO_PASSWORD`. Los dominios son ficticios; para recuperación por correo usa una cuenta real o Mailpit local. Repetir el script conserva cuentas y contraseñas existentes y se detiene si una cuenta coincide por correo pero sus datos ya no coinciden con la demo. Los UUID de las entradas son estables por cuenta, fecha y registro: los reintentos omiten entradas ya existentes, respetan las que hayas editado y no duplican el historial. Si falla a mitad, puede haber datos parciales: se puede reejecutar tras resolver el error. No elimina datos.

Los registros se crean con sesiones temporales de cada cuenta demo y las RPC existentes del diario, sin exponer su almacenamiento privado ni modificar permisos. Estas sesiones no envían correos ni cambian contraseñas, y se cierran al terminar. Las fechas emocionales son históricas, pero la actividad y las recompensas reflejan la fecha real de ejecución: la seed no inventa rachas históricas.

Puedes revisar el volumen sin credenciales ni modificaciones, o ajustar el historial entre 7 y 365 días:

```powershell
npm run demo:seed -- --dry-run
$env:DEMO_DAYS = "90"
npm run demo:seed
```

La seed requiere las migraciones del diario y de evolución personal. **Administración muestra personas, equipos, asignaciones y cuentas activas; las gráficas de bienestar agregado todavía están pendientes de implementación.** Añadir esta seed no activa ese panel ni da acceso a diarios individuales desde administración.

Los scripts administrativos rechazan URL remotas salvo que se añada `--allow-remote`, para evitar ejecutar una semilla por accidente en otro entorno:

```powershell
npm run auth:bootstrap -- --allow-remote
npm run demo:seed -- --allow-remote
```

Revisa antes la URL y usa exclusivamente un proyecto de demostración. Estos comandos usan credenciales de infraestructura; no forman parte de las funciones accesibles a usuarios de la aplicación.

## Proyecto Supabase alojado

1. Crea un proyecto de demostración y configura las variables de `.env.local`.
2. Vincúlalo y aplica la migración, revisando primero lo que se enviará:

   ```powershell
   supabase login
   supabase link --project-ref TU_PROJECT_REF
   supabase db push --dry-run
   supabase db push
   ```

3. En **Authentication**, deshabilita **Allow new users to sign up** y acceso anónimo. No basta con ocultar un formulario: hay que deshabilitar el registro en Auth. No configures proveedores sociales para esta demo.
4. Configura **Site URL** con el mismo origen de `APP_URL` y autoriza las URL exactas `/auth/callback` y `/auth/confirm`. Para despliegues utiliza HTTPS y un origen fijo.
5. En **Email Templates → Reset Password**, copia `supabase/templates/recovery.html`. El enlace usa `SiteURL` y `TokenHash` para verificar la recuperación en el servidor, incluso desde otro navegador.
6. Configura SMTP para destinatarios reales y los límites de Auth. El SMTP de pruebas alojado puede no entregar a cualquier destinatario y tiene límites estrictos; no sirve para una demo con empleados reales sin configurarlo.
7. En **Data API**, expón únicamente `public`. Verifica los permisos/RLS con los roles reales y ejecuta los advisors:

   ```powershell
   supabase db advisors --linked --type all --fail-on error
   ```

8. Ejecuta bootstrap con `--allow-remote`; después, opcionalmente, siembra la demo.

El `config.toml` configura el entorno local; **no se aplica automáticamente a Auth ni a las plantillas del proyecto alojado mediante `db push`**. La migración sí crea tablas, funciones, permisos y RLS. Una cuenta Auth sin perfil administrativo activo no obtiene acceso aunque se configure Auth incorrectamente; eso no sustituye deshabilitar el registro.

## Cómo probar los flujos

1. Entra como empresa: crea un equipo en «Equipos», crea un responsable en «Personas» y asígnalo a uno o varios equipos.
2. Crea empleados seleccionando su equipo. No se comparte una contraseña: cada nueva cuenta solicita «Recuperar acceso o establecer mi contraseña» desde el login.
3. Abre el correo en Mailpit (URL indicada por `supabase status`) o en el buzón real. Usa el enlace, establece una contraseña y vuelve al login. Un enlace usado o caducado debe solicitarse de nuevo.
4. Entra como responsable: verás solo tus empleados y equipos. Comprueba que no puedes acceder por URL directa a un empleado de otro equipo ni cambiar roles. Un traslado exige que seas responsable tanto del origen como del destino.
5. Entra como empleado: verás «Mi espacio», «Mi diario», «Mi evolución», «Para ti» y «Mi perfil». `/company`, `/team` y `/admin/users` deben redirigir a `/employee`. Los responsables y administradores también disponen de su espacio personal desde `/journal`.
6. Mantén una sesión de empleado abierta en un navegador y desactívalo desde otra sesión de empresa. En su siguiente solicitud perderá el acceso. Reactívalo desde el directorio.
7. Desactiva un responsable: se eliminan sus asignaciones. Reactivarlo requiere volver a asignarlas.
8. Prueba cierre de sesión, acceso sin sesión a las rutas privadas y cambio de contraseña. No debe existir registro público ni acceso a diarios individuales desde administración.

## Comprobaciones y mantenimiento

```powershell
npm run lint
npm run typecheck
npm test
npm run build
# Ejecuta los cuatro pasos anteriores:
npm run check
npm audit --omit=dev
```

Las pruebas predeterminadas usan PGlite, un motor PostgreSQL real embebido. Aplican todas las migraciones y emulan exclusivamente Auth y sus roles. Comprueban administración, RLS del diario, CRUD, aislamiento entre usuarios y ambos administradores, reintentos, filtros combinados, paginación y límites de día en zonas horarias con cambio de hora. No necesitan Docker ni credenciales. Estas pruebas por sí solas **no verifican GoTrue, SMTP, cookies SSR ni PostgREST real**.

Para verificar el PostgreSQL alojado sin dejar datos de prueba:

```powershell
npm run test:db:linked
```

Para verificar Auth y PostgREST reales, con las claves de `.env.local` y un proyecto de demostración:

```powershell
npm run test:integration -- --allow-remote
```

Este último script crea cuatro cuentas y un equipo aislados. El cliente privilegiado se usa únicamente para preparar y eliminar esas identidades: todas las operaciones del diario se prueban con sesiones reales y la clave pública. El bloque de limpieza elimina exclusivamente esos UUID, también si una prueba falla. Sin `--allow-remote`, solo permite localhost. Nunca lo ejecutes para medir sobre diarios reales de empleados.

La fase 3 se verificó además mediante Playwright/Edge en `http://localhost:3100`, escritorio 1440×1000 y móvil 390×844: login SSR, selección sin guardado automático, validación, fallo de red y reintento sin duplicación, consulta/edición, tarjetas/tabla, filtros, calendario, borrado con confirmación y dashboard real. Las cuentas de esa revisión se eliminaron al terminar. No se verificó SMTP ni recuperación por correo en esta fase.

Con Supabase local arrancado:

```powershell
supabase db lint --local
supabase db advisors --local --type all --fail-on error
npm run db:types
```

El contrato de tipos se regeneró desde el esquema alojado. `db:types` genera tipos reales de `public`, añade los alias del dominio y solo reemplaza el archivo si la CLI termina correctamente. Admite `npm run db:types -- --linked` para el proyecto enlazado. `schema.ts` conserva la nulabilidad intencional de los argumentos RPC de creación de equipos y perfiles administrativos, que la introspección no siempre refleja. Ejecuta `typecheck` después. Para cambios de esquema futuros crea una migración con `supabase migration new NOMBRE`, aplica y prueba; no edites una migración ya aplicada a otro entorno.

Los paquetes de Supabase están fijados con versiones exactas y `package-lock.json`. shadcn es una herramienta de desarrollo, no una dependencia de ejecución. La auditoría de desarrollo informa de avisos en `braces` y sus consumidores (ESLint/shadcn), sin versión corregida disponible en el informe actual; no se fuerza una regresión de Next.js ni una versión incompatible de shadcn para ocultarlos. La auditoría de producción no presenta avisos en la verificación de esta fase.

## Estado de la fase 3

Las migraciones del diario están aplicadas al proyecto Supabase enlazado. Pasaron las pruebas SQL alojadas, Auth/PostgREST, build, lint, tipos, 30 pruebas predeterminadas y la revisión de interfaz con sesiones reales. Se conservó el diseño existente. No se descargan todos los registros para filtrar: PostgreSQL devuelve páginas de 12 entradas y agrupaciones diarias limitadas al mes/semana. Los datos temporales de verificación se eliminaron.

Pendiente: configurar la protección de contraseñas filtradas en Supabase Auth (único aviso restante de los advisors), verificar SMTP/recuperación por correo y desarrollar IA/recursos y agregados anónimos en las fases correspondientes.


## Estado de la fase 4

La migración `20261013004038_personal_evolution.sql` está aplicada al proyecto enlazado y los tipos públicos se regeneraron desde ese esquema. Pasaron lint, tipos, pruebas automatizadas y build de producción; también las suites SQL de diario/evolución y ambos scripts de integración con Auth/PostgREST reales. La suite de evolución incluye 10.000 entradas y verifica medias por día, huecos, DST, rachas, reflexiones no repetibles, recompensas únicas y privacidad frente a ambos administradores. Playwright/Edge comprobó estados vacíos y poblados, períodos de 7/30/90 días y personalizados, calendarios, varios registros de un día, acceso al detalle y cambio de zona en escritorio 1440×1000 y móvil 390×844, sin errores de consola ni desbordamiento horizontal. Los fixtures se eliminaron; las capturas están fuera del repositorio.

Las rachas empiezan con acciones posteriores a la migración: no se inventa actividad histórica sin la zona personal que no se guardaba en la fase 3. El historial anterior sí aparece en las estadísticas. La zona se conserva entre dispositivos y se puede cambiar explícitamente en «Mi evolución».

```powershell
npm run test:db:evolution:linked
npm run test:integration:evolution -- --allow-remote
```

Supabase Advisors no encontró avisos nuevos en esta fase; permanece la protección de contraseñas filtradas desactivada. No se verificó SMTP ni recuperación por correo. La actualización entre dispositivos es persistente; una pestaña ya abierta requiere recargar para ver cambios de otro dispositivo. Los agregados de equipos/empresa siguen pendientes y separados de estos datos personales.

## Estado de la fase 5

Los dashboards de `/team`, `/company` y `/admin/insights` usan publicaciones PostgreSQL reales mediante `collective_statistics`. Las migraciones `20261013064054_collective_reporting.sql` y `20261013070550_collective_reporting_privileges.sql` están aplicadas al Supabase vinculado; los tipos públicos se regeneraron desde ese esquema. Hay distribución de ánimo, emociones, intensidad, motivos/factores laborales, evolución de seis períodos, participación protegida y comparaciones entre equipos publicables, con estados explícitos de carga, error e insuficiencia y detalles ampliables.

La política limita el análisis a meses y trimestres naturales cerrados, con umbral inicial configurable de 3 participantes reales, protección de categorías y complementos, redondeo, publicaciones únicas y retirada tras mutaciones históricas o cambios de plantilla. Los trimestres y la empresa reutilizan publicaciones seguras; los equipos protegidos no aportan a un total oculto. Cada participante pesa lo mismo, aunque registre muchas entradas. La metodología y los límites se describen en [docs/collective-reporting.md](docs/collective-reporting.md).

**La trazabilidad de composición comienza al aplicar la migración.** No se atribuyen registros anteriores a una plantilla cuya historia se desconoce. Sin cambios de composición, el primer mes potencialmente publicable es noviembre de 2026, al cerrar el 1 de diciembre. Las retiradas históricas son definitivas para evitar diferencias entre dos versiones. El resumen de empresa representa equipos publicables con pesos iguales, no necesariamente toda la plantilla. No se usa privacidad diferencial ni se afirma una garantía formal frente a todo conocimiento externo.

```powershell
npm run test:db:reporting:linked
npm run test:integration:reporting -- --allow-remote
```

Las suites PostgreSQL embebida y alojada prueban los límites de rol/equipo, RLS, grupos/categorías pequeñas, empresa frente a equipos suprimidos, períodos manipulados, peso de más de 6.000 entradas, traslados, altas/desactivaciones y cambios históricos. La integración usa Auth/PostgREST reales y verifica aislamiento y revocación con JWT vigente. Los fixtures SQL se revierten y las identidades de integración se eliminan. Sigue pendiente la configuración de protección de contraseñas filtradas de Auth.

Verificación final: 39 pruebas automatizadas, lint, TypeScript y build correctos; suites SQL alojadas de diario, evolución y reporting correctas; integración Auth/PostgREST de reporting y regresión de evolución correctas. Playwright con Edge comprobó el sitio real en `http://127.0.0.1:3000`, escritorio 1440×1000 y móvil 390×844: SSR de empresa/equipo, selectores, trimestres, detalles, error de red/reintento y redirección de empleado, sin desbordamiento ni errores de aplicación. Un montaje externo identificado como QA ficticia comprobó los gráficos poblados con agregados calculados en PostgreSQL, sin alterar la línea base real. No estaba disponible el plugin Browser. Las capturas y scripts temporales se guardaron fuera del repositorio. Supabase Advisors no encontró avisos de rendimiento ni nuevos avisos de seguridad.
