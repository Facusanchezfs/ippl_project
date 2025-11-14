# FIXES - Registro de Correcciones

Este archivo documenta todas las correcciones y mejoras implementadas en el proyecto IPPL.

---

## Estructura de Documentación

Para cada fix implementado, seguir el siguiente formato:

## X. [Título del Fix]

**Problema:** Descripción clara del problema encontrado.

**Solución:**
- Lista de cambios implementados
- Detalles técnicos relevantes
- Explicación del enfoque utilizado

**Archivos modificados:**
- Lista de archivos afectados

**Pruebas a realizar como usuario final:**
- Lista de verificaciones que debe hacer el usuario
- Pasos específicos para validar la corrección

---

## 1. Traducción de términos en inglés en actividades recientes

**Problema:** En la sección "Actividad Reciente" del profesional, aparecían términos en inglés como "biweekly", "weekly", "monthly", "approved", "pending" en lugar de sus equivalentes en español. Esto ocurría tanto en el componente de actividades recientes del dashboard como en la página completa de actividades.

**Solución:**
- Se agregaron funciones helper `translateFrequency()` y `translateDescription()` en ambos componentes
- `translateFrequency()` convierte valores de frecuencia: "weekly" → "Semanal", "biweekly" → "Quincenal", "monthly" → "Mensual"
- `translateDescription()` utiliza expresiones regulares para reemplazar todos los términos en inglés en las descripciones de actividades:
  - Frecuencias: weekly, biweekly, monthly
  - Estados: approved, rejected, pending, active, inactive
- Se aplica la traducción tanto en el texto de la descripción como en los valores del metadata (newFrequency, currentFrequency, requestedFrequency)
- La traducción se realiza en tiempo de renderizado, sin modificar los datos del backend

**Archivos modificados:**
- `src/components/professional/RecentActivityProfessional.tsx`
- `src/pages/professional/AllActivitiesPage.tsx`

**Pruebas a realizar como usuario final:**
1. Iniciar sesión como profesional
2. Navegar al dashboard del profesional
3. Verificar que en la sección "Actividad Reciente" todos los términos aparecen en español:
   - "biweekly" debe aparecer como "Quincenal"
   - "weekly" debe aparecer como "Semanal"
   - "monthly" debe aparecer como "Mensual"
   - "approved" debe aparecer como "Aprobado"
   - "pending" debe aparecer como "Pendiente"
4. Hacer clic en "Ver todas" para ir a la página completa de actividades
5. Verificar que las traducciones también funcionan en esa página
6. Aprobar o rechazar una solicitud de cambio de frecuencia y verificar que la notificación resultante muestre los términos en español

## 2. Dialog de confirmación antes de abonar

**Problema:** En el panel financiero, al hacer clic en el botón "Abonar", se ejecutaba inmediatamente la acción sin posibilidad de verificar o modificar el monto ingresado. Si el usuario se equivocaba con el monto, no podía cancelar la operación.

**Solución:**
- Se agregó un modal de confirmación (`ConfirmationModal`) que se muestra antes de ejecutar el abono
- El modal muestra claramente:
  - El nombre del profesional que recibirá el abono
  - El monto exacto que se va a abonar
- El usuario puede:
  - Confirmar el abono haciendo clic en "Confirmar Abono"
  - Cancelar la operación haciendo clic en "Cancelar", lo que permite modificar el monto en el input
- Se agregó estado `showConfirmModal` y `pendingAbono` para controlar el modal y almacenar temporalmente los datos del abono pendiente
- La función `handleAbonar` ahora solo muestra el modal, y `handleConfirmAbonar` ejecuta la operación real
- Se agregó un mensaje de éxito con toast después de confirmar el abono

**Archivos modificados:**
- `src/pages/FinancialPagosPage.tsx`

**Pruebas a realizar como usuario final:**
1. Iniciar sesión como usuario financiero o admin
2. Navegar a la sección "Pagos" del panel financiero
3. Ingresar un monto en el campo "Abonar" para cualquier profesional
4. Hacer clic en el botón "Abonar"
5. Verificar que aparece un modal de confirmación mostrando:
   - Título: "Confirmar Abono"
   - Mensaje con el nombre del profesional y el monto a abonar
   - Botones "Confirmar Abono" y "Cancelar"
6. Hacer clic en "Cancelar" y verificar que:
   - El modal se cierra
   - El monto permanece en el input para poder modificarlo
7. Volver a hacer clic en "Abonar" y esta vez confirmar
8. Verificar que:
   - El abono se ejecuta correctamente
   - Aparece un mensaje de éxito
   - El input se limpia
   - Los saldos se actualizan

## 3. Mejoras en el listado de usuarios

**Problema:** El listado de usuarios tenía varios problemas de UX:
- El botón de editar no tenía tooltip descriptivo
- El botón para deshabilitar usuarios activos usaba el icono de basura (Trash2) en lugar de una flecha hacia abajo
- No existía un botón para eliminar permanentemente usuarios inhabilitados
- Los tooltips no eran descriptivos o estaban incorrectos

**Solución:**
- Se agregó tooltip "Editar usuario" al botón de editar
- Se cambió el botón de deshabilitar para usuarios activos:
  - Ahora usa el icono `ArrowBigDown` (flecha hacia abajo) en color rojo
  - Tooltip: "Deshabilitar usuario"
- Se agregó botón de eliminar permanentemente:
  - Solo se muestra para usuarios con estado "inactive"
  - Usa el icono `Trash2` (tachito de basura) en color rojo
  - Tooltip: "Eliminar usuario permanentemente"
  - Incluye modal de confirmación con advertencia de que la acción no se puede deshacer
- Se mejoró el botón de habilitar:
  - Tooltip: "Habilitar usuario"
- Se agregó estado y funciones para manejar la eliminación permanente
- Se implementó el endpoint en el backend para eliminación física de usuarios

**Archivos modificados:**
- `src/components/admin/UserManagement.tsx`
- `src/services/user.service.ts`
- `backend/src/controllers/userController.js`
- `backend/src/routes/users.js`

**Pruebas a realizar como usuario final:**
1. Iniciar sesión como admin
2. Navegar a la sección "Usuarios" del panel de administración
3. Verificar que al pasar el mouse sobre el botón de editar aparece el tooltip "Editar usuario"
4. Para un usuario activo:
   - Verificar que aparece un botón con flecha hacia abajo roja
   - Al pasar el mouse, debe mostrar "Deshabilitar usuario"
   - Al hacer clic, debe aparecer el modal de confirmación para desactivar
5. Para un usuario inactivo:
   - Verificar que aparecen dos botones:
     - Flecha hacia arriba verde con tooltip "Habilitar usuario"
     - Tachito de basura rojo con tooltip "Eliminar usuario permanentemente"
   - Hacer clic en el botón de eliminar
   - Verificar que aparece un modal de confirmación con advertencia
   - Confirmar la eliminación y verificar que el usuario desaparece de la lista
6. Verificar que no se puede eliminar permanentemente un usuario activo (debe aparecer error)

## 4. Página 404 y accesos a Reportes

**Problema:** La ruta de “Reportes” desde el panel administrativo llevaba a un error 404 porque no existía el path `/admin/reportes`. Además, la página 404 reutilizaba el componente de reportes y no seguía la estética general del sitio (sin encabezado ni pie de página consistentes).

**Solución:**
- Se creó una página 404 propia con el estilo público de IPPL, mensajes claros y botones de acción (volver al inicio, contactar al equipo)
- La nueva página 404 se renderiza dentro de `PublicLayout` para heredar encabezado, CTA, botones flotantes y footer
- Se actualizó la navegación de rutas para que `/admin/reportes` cargue correctamente el módulo de reportes
- Se registró la ruta `/404` dentro del layout público y se mantuvo la redirección para cualquier ruta no encontrada

**Archivos modificados:**
- `src/pages/404.tsx`
- `src/App.tsx`

**Pruebas a realizar como usuario final:**
1. Acceder a una URL inexistente (por ejemplo, `/pagina-que-no-existe`)
   - Debe redirigir a `/404`
   - Verificar que se muestra la nueva página con encabezado y footer
   - Comprobar que los botones “Volver al inicio” y “Contactar al equipo” funcionan
2. Desde el dashboard admin, hacer clic en “Reportes”
   - Debe navegar a `/admin/reportes` sin mostrar 404
3. Ingresar directamente a `/admin/reportes` estando autenticado como admin
   - Debe renderizar la página de reportes dentro del layout administrativo

## 5. Notificaciones de solicitudes de cambio de frecuencia

**Problema:** Cuando un profesional solicitaba un cambio de frecuencia, la notificación no aparecía en el panel de actividades del administrador. El backend registraba la actividad con el tipo `FREQUENCY_CHANGE_REQUESTED`, pero el endpoint y los componentes del panel sólo contemplaban `FREQUENCY_CHANGE_REQUEST`, por lo que la solicitud nunca se mostraba.

**Solución:**
- Se añadió el tipo `FREQUENCY_CHANGE_REQUESTED` a la lista de actividades relevantes que devuelve el backend
- Se actualizó la lista de tipos admitidos en los componentes `RecentActivity` y `ActivityPage` para que contemplen ambos valores (`REQUEST` y `REQUESTED`)
- Se creó un arreglo común `RELEVANT_ACTIVITY_TYPES` para evitar duplicaciones y facilitar futuros ajustes
- Se amplió la definición de `ActivityType` para incluir todos los tipos utilizados actualmente

**Archivos modificados:**
- `backend/src/controllers/activityController.js`
- `src/components/admin/RecentActivity.tsx`
- `src/pages/ActivityPage.tsx`
- `src/types/Activity.ts`

**Pruebas a realizar como usuario final:**
1. Iniciar sesión como profesional y solicitar un cambio de frecuencia para un paciente
2. Sin desloguearse, iniciar sesión como admin (en otra ventana o después de aprobar) y abrir el panel de Actividad (`/admin/actividad`)
   - La nueva solicitud debe aparecer destacada
3. Revisar el widget "Notificaciones del sistema" en el dashboard admin
   - Debe listar la misma solicitud marcada como no leída
4. Aprobar o rechazar la solicitud desde el flujo habitual y verificar que las notificaciones respondan en consecuencia (cambian de color y se marcan como leídas si se desea)

## 6. Eliminación de datos hardcodeados en la gestión de profesionales

**Problema:** La pantalla "Gestión de Profesionales" mostraba un listado ficticio con datos hardcodeados (nombres, correos, pacientes, etc.) que no pertenecían al instituto. Esto generaba confusión porque el personal veía información que nunca había cargado.

**Solución:**
- Se eliminaron los mocks y ahora la sección consume la información real del backend
- Se consultan los profesionales a través de `userService.getProfessionals()`
- Se obtienen todos los pacientes (`patientsService.getAllPatients()`) para calcular cuántos tiene asignado cada profesional y cuántos están activos
- Se muestran datos disponibles de la entidad `User`: comisión, saldo total, saldo pendiente, estado y fecha de creación
- Se añadieron estados de carga, manejo de errores y botón de refresco para actualizar la información

**Archivos modificados:**
- `src/components/admin/PsychologistManagement.tsx`

**Pruebas a realizar como usuario final:**
1. Iniciar sesión como administrador y navegar a la sección "Profesionales" desde el panel
2. Verificar que el listado refleja profesionales reales (los mismos que figuran en "Usuarios" o en la base de datos)
3. Comprobar que la búsqueda funciona por nombre o email y que el filtro de estado muestra solo activos/inactivos según corresponda
4. Pulsar "Actualizar" y confirmar que se recarga la información sin mostrar datos ficticios

## 7. Recalcular saldo pendiente al cambiar la comisión

**Problema:** Al actualizar el porcentaje de comisión de un profesional desde el panel financiero, el campo `saldoPendiente` permanecía con el valor anterior (por ejemplo, 30% → 20% seguía mostrando el mismo importe). Esto provocaba inconsistencias en el dashboard y en los reportes.

**Solución:**
- Se agregó la función `round2` en el controlador de usuarios para redondear valores monetarios a dos decimales
- En `updateUser`, si la comisión viene en la petición y el usuario es un profesional, se recalcula automáticamente `saldoPendiente` como `saldoTotal * (comisión / 100)`
- También se normaliza `saldoTotal` cuando es incluido en la actualización para que quede alineado con los montos guardados en la base

**Archivos modificados:**
- `backend/src/controllers/userController.js`

**Pruebas a realizar como usuario final:**
1. Ir a “Pagos” en el panel financiero
2. Cambiar la comisión de un profesional y pulsar “Actualizar”
3. Verificar que el valor de “Saldo Pendiente” se actualiza de inmediato con el porcentaje nuevo (sin recargar la página)
4. Confirmar que al refrescar la sección el valor permanece consistente

## 8. Ajuste de saldo pendiente al finalizar citas

**Problema:** Al finalizar una cita (estado `completed` + `attended`), `saldoPendiente` del profesional sólo sumaba el porcentaje de la última sesión (`delta * comisión`). Si existían múltiples citas, el resultado podía no coincidir con `saldoTotal * comisión`, generando diferencias como 30% de 25.000 = 4.500 en lugar de 7.500.

**Solución:**
- Se modificó el helper `applyDelta` de `updateAppointment` para recalcular `saldoPendiente` en base al `saldoTotal` consolidado tras cada actualización (ahora `saldoPendiente = saldoTotal * comisión / 100`)
- Se mantuvo la lógica de sumar/restar `delta` al `saldoTotal`, pero el pendiente se deriva siempre del total acumulado con la comisión vigente

**Archivos modificados:**
- `backend/src/controllers/appointmentsController.js`

**Pruebas a realizar como usuario final:**
1. Finalizar dos citas asistidas para un profesional con comisión 30% (ej. montos 15.000 y 10.000)
2. Revisar el panel financiero y verificar que `saldoPendiente` sea 7.500 (30% de 25.000)
3. Cambiar la comisión a otro valor y confirmar que el pendiente se actualiza acorde (ver fix 7)

## 9. Refresco inmediato del saldo pendiente en el panel financiero

**Problema:** Aunque el backend ya recalculaba el saldo pendiente al cambiar la comisión, el panel de pagos mostraba el valor anterior hasta que se recargaba la página.

**Solución:**
- Se agregó un estado `commissionSaving` en `FinancialPagosPage` para manejar el ciclo de actualización de comisión
- Después de guardar el nuevo porcentaje, se vuelve a invocar `fetchProfessionals()` para traer los saldos actualizados del backend y refrescar la UI
- El botón "Actualizar" muestra feedback (“Actualizando…”) y se deshabilita mientras la solicitud está en curso

**Archivos modificados:**
- `src/pages/FinancialPagosPage.tsx`

**Pruebas a realizar como usuario final:**
1. En “Pagos”, cambiar la comisión de un profesional y pulsar "Actualizar"
2. Confirmar que el botón muestra el estado de carga y que, al finalizar, la grilla refleja el nuevo `saldoPendiente` sin recargar la página
3. Repetir la operación con otro valor para verificar que el comportamiento es consistente

## 10. Corrección en la visualización y actualización de abonos

**Problema:** Los abonos mostrados en el panel financiero podían quedar desactualizados (la lista no se refrescaba) y algunos montos se mostraban con valores inconsistentes.

**Solución:**
- Se aseguró que los montos de abonos se conviertan explícitamente a número (`Number(a.amount)`) antes de formatearlos
- El botón “Actualizar” del panel financiero ahora vuelve a cargar estadísticas, profesionales y abonos en paralelo, garantizando que los nuevos pagos aparezcan inmediatamente

**Archivos modificados:**
- `src/components/admin/FinancialDashboard.tsx`

**Pruebas a realizar como usuario final:**
1. Registrar un abono desde “Pagos”
2. Navegar al panel financiero o pulsar “Actualizar” y verificar que el abono recién registrado aparezca en la sección “Transacciones Recientes” con el monto correcto
3. Repetir la operación con diferentes valores para confirmar que la lista refleja siempre la información actualizada

## 11. Botón volver en historial de actividades

**Problema:** En `/admin/actividad`, el botón "Volver" redirigía siempre a la raíz (`/`), incluso para administradores; debía regresar al dashboard correspondiente.

**Solución:**
- Se incorporó `useAuth` en la página para detectar el rol
- Administradores vuelven a `/admin`, profesionales a `/professional` y el resto a `/`

**Archivos modificados:**
- `src/pages/ActivityPage.tsx`

**Pruebas:** Acceder a la página desde un usuario admin y otro profesional y verificar que el botón redirige al dashboard correcto.

## 12. Ocultar al usuario actual en la gestión de usuarios

**Problema:** El administrador podía verse a sí mismo en la lista de usuarios y tenía opciones de editar/deshabilitar su propia cuenta.

**Solución:**
- Se usa el contexto de autenticación para filtrar al usuario actual del listado

**Archivo:** `src/components/admin/UserManagement.tsx`

**Pruebas:** Entrar como admin y comprobar que su usuario ya no aparece en la tabla.

## 13. Modal de descripción sin doble cierre

**Solución:** Se eliminó el segundo botón `X` dentro del modal, dejando sólo el cierre provisto por el componente `Modal`.

**Archivo:** `src/components/professional/ProfessionalPatients.tsx`

**Pruebas:** Abrir "Ver descripción" y verificar que sólo hay un botón de cierre.

## 14. Solicitudes de frecuencia visibles en el dashboard

**Problema:** El resumen de actividades del dashboard admin sólo mostraba solicitudes de baja.

**Solución:**
- Se creó una lista de tipos relevantes que incluye cambios de frecuencia para filtrar las actividades

**Archivo:** `src/components/admin/Dashboard.tsx`

**Pruebas:** Enviar una solicitud de cambio de frecuencia y confirmar que aparece en la tarjeta de “Actividad reciente”.

## 15. Actualizar comisión sin perder posición en Pagos

**Problema:** Al actualizar comisión en la lista de Pagos, se activaba el loader completo y el scroll volvía al inicio.

**Solución:**
- `fetchProfessionals` acepta un flag `showLoading`
- `handleCommision` reutiliza la posición del scroll tras refrescar los datos

**Archivo:** `src/pages/FinancialPagosPage.tsx`

**Pruebas:** Ir al final de la tabla, actualizar una comisión y comprobar que la página mantiene la posición.

## 16. Traducciones en solicitudes financieras

**Solución:** Se añadieron helpers para mostrar frecuencias (`Semanal`, `Quincenal`, etc.) y estados (`Pendiente`, `Aprobada`, `Rechazada`).

**Archivo:** `src/pages/FinancialSolicitudesPage.tsx`

**Pruebas:** Abrir una solicitud y validar que no aparezcan textos en inglés.

## 17. Flecha de regreso en reportes admin

**Solución:** Se añadió botón “Volver al Dashboard” al inicio de `/admin/reportes`.

**Archivo:** `src/pages/admin/ReportsPage.tsx`

**Pruebas:** Ingresar a reportes y confirmar que el botón lleva nuevamente al dashboard.

## 18. Mensajes accesibles para content manager

**Problema:** El rol `content_manager` no tenía acceso directo a la bandeja de mensajes.

**Solución:**
- Ruta `/content/mensajes`
- Botón “Ver mensajes” en el dashboard de contenido
- Página de mensajes muestra un botón regresar que respeta el rol del usuario

**Archivos:**
- `src/App.tsx`
- `src/components/admin/ContentDashboard.tsx`
- `src/pages/AdminMessages.tsx`

**Pruebas:** Iniciar sesión como content_manager → usar el nuevo acceso y verificar que puede leer/gestionar mensajes.

## 19. Ajuste visual en reportes admin

**Problema:** En `/admin/reportes` el contenido quedaba oculto por el header fijo; la flecha de regreso no era visible.

**Solución:** Se añadió un `pt-24` al contenedor principal para respetar la altura del header.

**Archivo:** `src/pages/admin/ReportsPage.tsx`

**Pruebas:** Ingresar a reportes y confirmar que todo el contenido (incluida la flecha) queda visible desde el inicio.

## 20. Traducción y visibilidad de solicitudes de frecuencia

**Problema:** Las notificaciones mostraban textos en inglés (biweekly/pending) y una solicitud nueva no aparecía en el dashboard admin hasta recargar.

**Solución:**
- `createActivity` ahora normaliza título y descripción en español cuando el tipo es `FREQUENCY_CHANGE_*`
- Dashboard admin y listado de actividades traducen las frecuencias y estados a texto legible
- Se garantiza que las solicitudes en estado “requested/request” también se agreguen a la lista

**Archivos:**
- `backend/src/controllers/activityController.js`
- `src/components/admin/Dashboard.tsx`
- `src/components/professional/RecentActivityProfessional.tsx`
- `src/pages/ActivityPage.tsx`

**Pruebas:**
1. Enviar una solicitud de cambio de frecuencia como profesional
2. Revisar el dashboard admin sin recargar manualmente: la tarjeta de notificaciones debe mostrar la solicitud en español
3. Abrir “Ver todas” y confirmar que el texto también está traducido

---

## 21. Ajustes de saldos en paneles financieros

**Problema:** En la gestión de pagos y el dashboard financiero se mostraban columnas y tarjetas con “Saldo Total” que no aportaban valor y generaban dudas en el equipo. Además, las acciones de la tabla del dashboard eran texto plano sin tooltip.

**Solución:**
- Se eliminó la columna “Saldo Total” de la tabla de `Gestión de Pagos`, manteniendo intacta la lógica de cálculo de comisiones y abonos.
- Se removió la tarjeta verde de “Saldo Total Profesionales” y la columna homónima en la tabla de resumen del dashboard financiero.
- Se actualizaron las acciones de la tabla del dashboard para mostrarse como iconos (`Eye`, `ArrowDownTray`) con `title` accesible.

**Archivos modificados:**
- `src/pages/FinancialPagosPage.tsx`
- `src/components/admin/FinancialDashboard.tsx`

**Complejidad estimada:** Media.

**Pruebas a realizar como usuario final:**
1. Ingresar a “Gestión de Pagos” y verificar que la tabla ya no muestra la columna “Saldo Total” y que los abonos/actualizaciones siguen funcionando.
2. Abrir el dashboard financiero y comprobar que desapareció la tarjeta verde, la tabla solo contiene “Saldo Pendiente” y las acciones se muestran como iconos con tooltip al pasar el mouse.
3. Descargar un PDF o abrir el detalle de un profesional desde el dashboard para confirmar que los botones continúan operando correctamente.

---

## 22. Paginación en tarjetas del dashboard financiero

**Problema:** Las tarjetas “Transacciones Recientes” y “Resumen por Profesional” mostraban todos los elementos en una única vista, generando scrolls extensos e incómodos cuando la cantidad de registros crecía.

**Solución:**
- Se paginaron las transacciones recientes para mostrar 10 registros por página, con controles “Anterior” y “Siguiente” dentro de la tarjeta.
- Se implementó la misma paginación en el resumen por profesional, también con páginas de 10 elementos.
- Se reinician las páginas al refrescar datos para mantener consistencia tras realizar acciones.

**Archivos modificados:**
- `src/components/admin/FinancialDashboard.tsx`

**Complejidad estimada:** Media.

**Pruebas a realizar como usuario final:**
1. Ingresar al dashboard financiero y verificar que cada tarjeta muestra un máximo de 10 elementos iniciales.
2. Usar los botones de paginación de “Transacciones Recientes” para navegar entre páginas.
3. Repetir la navegación en “Resumen por Profesional” y confirmar la independencia entre tarjetas.
4. Pulsar “Actualizar datos” y comprobar que ambas tarjetas vuelven a la primera página.

---

## 23. Envío de comprobantes por correo desde “Gestión de Pagos”

**Problema:** El equipo financiero necesita remitir semanalmente varios comprobantes de transferencia (PDF o imágenes) al correo corporativo. El panel no ofrecía una forma integrada de adjuntar múltiples archivos ni de incluir los datos clave del pago, lo que obligaba a procesos manuales.

**Solución:**
- Se incorporó `nodemailer` al backend y se creó el servicio `sendPaymentReceiptsEmail`, parametrizado mediante variables de entorno (`EMAIL_SENDER`, `APP_KEY`, opcionalmente `SMTP_HOST/PORT`), con envío predeterminado a `ipplcdlu@gmail.com`.
- Se agregó el endpoint protegido `POST /api/payments/send-receipts`, que usa `multer` en memoria, exige al menos un adjunto y envía el correo con todos los archivos y metadatos.
- Se actualizó la página “Gestión de Pagos” con un botón “Enviar comprobantes” por profesional, que abre un modal para capturar monto abonado, deuda actual, saldo a favor (calculado automáticamente), fecha límite, notas y adjuntar hasta 10 archivos. Los campos monetarios muestran prefijo en pesos y vista previa formateada, y el correo destino queda fijo en la casilla institucional.
- En el dashboard financiero se habilitó ordenar la tabla de profesionales por nombre o por saldo pendiente, respetando la paginación.
- Se creó `payment.service.ts` para encapsular el envío de `FormData` y mostrar toasts de éxito/error al usuario.

**Archivos modificados:**
- `backend/package.json`
- `backend/package-lock.json`
- `backend/src/app.js`
- `backend/src/index.js`
- `backend/src/controllers/paymentController.js`
- `backend/src/routes/payments.js`
- `backend/src/services/emailService.js`
- `src/pages/FinancialPagosPage.tsx`
- `src/services/payment.service.ts`

**Complejidad estimada:** Media.

**Pruebas a realizar como usuario final:**
1. Configurar en `.env` del backend al menos `EMAIL_SENDER` y `APP_KEY` (contraseña de aplicación).
2. Iniciar sesión con un usuario financiero o administrador y abrir “Gestión de Pagos”.
3. Seleccionar un profesional y pulsar “Enviar comprobantes”.
4. Completar los campos, adjuntar varios PDF/imágenes y enviar.
5. Confirmar que aparece el toast de éxito y que el correo llega con los adjuntos al buzón configurado.

---

*Última actualización: 2025-11-11*
*Total de fixes documentados: 23*