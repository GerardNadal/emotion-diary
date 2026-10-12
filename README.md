# Dentro · Diario emocional

Aplicación interna para una única empresa. Implementa autenticación, directorio, equipos, responsables, permisos e interfaces responsive para los tres roles. La fase 2 añade el espacio personal, un registro emocional de vista previa, historial, calendario, evolución, recursos y perfil. El almacenamiento del diario, las estadísticas, las rachas, las recompensas y la IA se conectarán en próximas fases. No se muestran estadísticas emocionales ficticias.

Consulta las pantallas y los puntos de integración en [docs/interfaces.md](docs/interfaces.md).

Consulta las decisiones y el modelo de autorización en [docs/architecture.md](docs/architecture.md).

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
| `responsable@example.test` | Equipo | Demo · Desarrollo |
| `desarrollo@example.test` | Empleado | Demo · Desarrollo |
| `operaciones@example.test` | Empleado | Demo · Operaciones |

Usan la contraseña que proporcionaste en `DEMO_PASSWORD`. Los dominios son ficticios; para recuperación por correo usa una cuenta real o Mailpit local. Repetir el script conserva cuentas y contraseñas existentes y se detiene si una cuenta coincide por correo pero sus datos ya no coinciden con la demo. Si falla a mitad, puede haber datos parciales: se puede reejecutar tras resolver el error. No elimina datos ni siembra entradas emocionales.

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

Las pruebas usan PGlite, un motor PostgreSQL real embebido. Aplican la migración completa y simulan exclusivamente `auth.users`, `auth.uid()` y los roles de Supabase. Comprueban RLS, permisos SQL/RPC, bootstrap, empleados con un equipo, traslado entre equipos, escalada de roles, bajas con un JWT existente y esquemas privados. No necesitan Docker ni credenciales. **No verifican GoTrue, SMTP, cookies SSR ni PostgREST real**; los pasos manuales anteriores deben realizarse en el entorno configurado.

Con Supabase local arrancado:

```powershell
supabase db lint --local
supabase db advisors --local --type all --fail-on error
npm run db:types
```

El contrato de tipos inicial está alineado con esta migración. `db:types` genera tipos reales de `public`, añade los alias del dominio y solo reemplaza el archivo si la CLI termina correctamente. `schema.ts` conserva la nulabilidad intencional de los argumentos RPC de creación de equipos y perfiles administrativos, que la introspección no siempre refleja. Ejecuta `typecheck` después. Para cambios de esquema futuros crea una migración con `supabase migration new NOMBRE`, aplica y prueba localmente; no edites una migración ya aplicada a otro entorno.

Los paquetes de Supabase están fijados con versiones exactas y `package-lock.json`. shadcn es una herramienta de desarrollo, no una dependencia de ejecución. La auditoría de desarrollo informa de avisos en `braces` y sus consumidores (ESLint/shadcn), sin versión corregida disponible en el informe actual; no se fuerza una regresión de Next.js ni una versión incompatible de shadcn para ocultarlos. La auditoría de producción no presenta avisos en la verificación de esta fase.

## Pendiente para habilitar una demo completa

- Proporcionar URL y claves del proyecto.
- Arrancar Supabase local o aplicar la migración al proyecto alojado.
- Deshabilitar registro público en el proyecto alojado y configurar SMTP, origen y plantilla.
- Crear el administrador inicial y, opcionalmente, los datos ficticios.
- Ejecutar los flujos con Auth/SMTP reales y revisar advisors.
- En próximas fases: diseño visual completo, diario privado, agregados con protección de anonimato, estadísticas personales, rachas e IA.
