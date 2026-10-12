# Interfaces · Fase 2

Dentro usa una identidad ligera: fondos claros, lavanda para el registro, menta y melocotón para acentos, tipografía Geist y navegación con iconos Lucide. La pantalla de inicio se limita a emoción, semana y una pausa. Los campos menos frecuentes están plegados. No se usan fotos, registro público ni funciones sociales.

## Pantallas y datos

| Ruta | Pantalla | Comportamiento actual |
| --- | --- | --- |
| `/login`, `/recover`, `/update-password` | Acceso y contraseña | Acciones de autenticación existentes; sin registro público |
| `/employee` | Inicio del empleado | Selector emocional, semana sin datos y racha pendiente |
| `/journal` | Espacio personal de cualquier rol | El mismo inicio privado; disponible también para administradores |
| `/journal/new` | Registro de vista previa | Emoción, intensidad, motivos laborales y personales, reflexión y detalles opcionales; revisión sin guardar |
| `/journal/history` | Historial | Vistas de tarjetas, tabla y calendario; sin entradas ficticias |
| `/insights` | Evolución personal | Calendario navegable y espacios para gráficos y recompensas pendientes |
| `/recommendations` | Recursos | Pausa general, recomendaciones de IA y música pendientes |
| `/profile` | Perfil básico | Nombre, correo, rol y equipo reales; acceso a cambio de contraseña; sin fotografía |
| `/company`, `/team` | Resumen administrativo | Cantidades exactas de empleados y cuentas activas, equipos autorizados y accesos a gestión |
| `/admin/users` | Directorio | Datos reales paginados, tabla/tarjetas y búsqueda explícita dentro de la página actual |
| `/admin/users/new`, `/admin/users/[id]` | Alta y edición | Server Actions existentes; validación visual; alta de empleados bloqueada sin un equipo disponible |
| `/admin/teams` | Equipos y responsables | Gestión existente de empresa; consulta y acceso al directorio para responsables |
| `/admin/insights` | Bienestar agregado | Selectores de periodo/equipo y estados sin estadísticas; futura comparación entre equipos |

La navegación lateral se convierte en menú y accesos inferiores en móvil. Incluye enlace para saltar al contenido, controles de teclado, foco visible, cierre del menú con Escape y respeto a movimiento reducido. Las rutas protegidas tienen estados de carga y error.

## Separación de responsabilidades

- Las rutas conservan `requireProfile` y las comprobaciones de rol del servidor. Las mutaciones administrativas, autenticación, RPC, migraciones y políticas no se han modificado.
- Los resúmenes administrativos usan el cliente SSR y RLS existente. Los conteos exactos no se calculan a partir de una página del directorio. Solo cuentan datos administrativos, nunca emociones.
- Los componentes de diario no consultan tablas ni envían entradas a Server Actions. El formulario usa estado temporal de React y dice explícitamente que no guarda datos. Salir de la pantalla descarta su contenido.
- La administración no importa componentes ni consultas del diario. Su módulo de estadísticas recibe solo equipos autorizados y mantiene estados vacíos.
- No hay fixtures ni rutas de prueba incorporados al producto. Las cuentas de demostración siguen siendo optativas y explícitas mediante el script existente `demo:seed`.

## Próximas integraciones

1. Persistencia del diario con permisos exclusivos del propietario, sin excepciones para administradores.
2. Historial real, calendario emocional, gráficos personales y rachas a partir de las entradas privadas.
3. Recompensas calculadas, recomendaciones de IA y música con sus estados de carga y error.
4. API de agregados que valide alcance, umbral de participantes y protección frente a reconstrucción de datos. La selección de periodos actual solo prepara la interfaz; no realiza cálculos.

Para la navegación con sesiones reales, configurar Supabase y usar las cuentas descritas en el README. La revisión visual sin ese servicio se realiza con componentes reales y fixtures temporales aislados; no equivale a probar autenticación o mutaciones contra un proyecto Supabase en funcionamiento.
