# Interfaces · Fases 3 y 4

Dentro usa una identidad ligera: fondos claros, lavanda para el registro, menta y melocotón para acentos, tipografía Geist y navegación con iconos Lucide. La pantalla de inicio se limita a estado de ánimo, semana y una pausa. Los campos menos frecuentes están plegados. No se usan fotos, registro público ni funciones sociales.

## Pantallas y datos

| Ruta | Pantalla | Comportamiento actual |
| --- | --- | --- |
| `/login`, `/recover`, `/update-password` | Acceso y contraseña | Acciones de autenticación existentes; sin registro público |
| `/employee` | Inicio del empleado | Cinco estados de ánimo; la primera pulsación abre el formulario sin guardar; resumen emocional de siete días, racha actual, actividad semanal y acceso a evolución reales |
| `/journal` | Espacio personal de cualquier rol | El mismo inicio privado; disponible también para administradores |
| `/journal/new` | Registro privado | Cinco estados de ánimo, nueve emociones e intensidad; detalles opcionales plegados; revisión y guardado con validación, carga y reintentos |
| `/journal/history` | Historial | Tarjetas, tabla y calendario reales; filtros en servidor por período/emoción/intensidad/categoría, orden y páginas de 12; selección y borrado con confirmación |
| `/journal/[id]`, `/journal/[id]/edit` | Detalles y edición | Todos los campos del registro propio, fechas locales, modificación y borrado individual; entradas ajenas no disponibles |
| `/insights` | Evolución personal | Estadísticas de ánimo/emoción/intensidad, motivos, comparación, ventanas 7/30/90 días y personalizadas; calendario emocional, actividad, rachas y recompensas; zona horaria persistente |
| `/recommendations` | Recursos | Pausa general, recomendaciones de IA y música pendientes |
| `/profile` | Perfil básico | Nombre, correo, rol y equipo reales; acceso a cambio de contraseña; sin fotografía |
| `/company`, `/team` | Resumen administrativo | Cantidades exactas de empleados y cuentas activas, equipos autorizados y accesos a gestión |
| `/admin/users` | Directorio | Datos reales paginados, tabla/tarjetas y búsqueda explícita dentro de la página actual |
| `/admin/users/new`, `/admin/users/[id]` | Alta y edición | Server Actions existentes; validación visual; alta de empleados bloqueada sin un equipo disponible |
| `/admin/teams` | Equipos y responsables | Gestión existente de empresa; consulta y acceso al directorio para responsables |
| `/admin/insights` | Bienestar agregado | Selectores de periodo/equipo y estados sin estadísticas; futura comparación entre equipos |

La navegación lateral se convierte en menú y accesos inferiores en móvil. Incluye enlace para saltar al contenido, controles de teclado, foco visible, cierre del menú con Escape y respeto a movimiento reducido. Las rutas protegidas tienen estados de carga y error.

## Separación de responsabilidades

- Las rutas conservan `requireProfile` y las comprobaciones de rol. El diario añade su API privada y políticas propias; mantiene las funciones y permisos de administración.
- Los resúmenes administrativos usan el cliente SSR y RLS existente. Los conteos exactos no se calculan a partir de una página del directorio. Solo cuentan datos administrativos, nunca emociones.
- Los componentes del diario llaman a Server Actions con el cliente SSR del actor. Los campos se mantienen cuando falla el guardado; se muestra confirmación solo tras una respuesta de la base de datos. Los reintentos de creación reutilizan el UUID y no duplican entradas. Salir del formulario sin guardar descarta su estado temporal; no se persisten borradores sensibles en el navegador.
- La administración no importa componentes ni consultas del diario. Su módulo de estadísticas recibe solo equipos autorizados y mantiene estados vacíos.
- No hay fixtures ni rutas de prueba incorporados al producto. Las cuentas de demostración siguen siendo optativas y explícitas mediante el script existente `demo:seed`.

## Próximas integraciones

1. Recomendaciones de IA, recursos y música con sus estados de carga y error; solo acciones de bienestar completadas pueden incorporarse a la actividad.
2. API de agregados que valide alcance, umbral de participantes y protección frente a reconstrucción de datos. La selección de periodos actual solo prepara la interfaz; no realiza cálculos.

La fase 3 se verificó contra Supabase alojado con Auth/PostgREST y cookies SSR reales. Playwright/Edge comprobó los flujos y el diseño en escritorio y móvil con cuentas temporales aisladas que se eliminaron. El README describe las pruebas ejecutables y los límites de lo verificado.

La fase 4 mantiene el calendario existente y añade todos los ánimos distintos de cada día con un conteo de entradas. El calendario de actividad reutiliza su cuadrícula y navegación, con marcas de días de acciones realizadas. Las estadísticas diferencian ánimo (escala ordinal), emoción (nueve categorías) e intensidad (fuerza 1–5), ofrecen datos tabulares accesibles y explican los días sin registros. No se muestran cifras inventadas ni tendencias con pocos días. Las reglas y pruebas se documentan en [personal-evolution.md](personal-evolution.md).
