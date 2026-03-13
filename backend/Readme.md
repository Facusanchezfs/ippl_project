# Backend API Documentation

## Requirements

- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)
- MySQL (v8.0 or higher)

## Configuración Inicial

### Variables de Entorno

1. Copia el archivo `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```

2. **OBLIGATORIO:** Configura `JWT_SECRET`:
   - Debe tener al menos 32 caracteres
   - Debe ser aleatorio y seguro
   - Genera uno con: `openssl rand -base64 32`
   - **El servidor NO iniciará sin esta variable configurada**

3. Configura las credenciales de base de datos según tu entorno.

### Variables Críticas

- `JWT_SECRET` (OBLIGATORIO): Secreto para firmar tokens JWT. Mínimo 32 caracteres.
- `DB_USER`, `DB_PASS`, `DB_NAME`: Credenciales de base de datos para desarrollo (tienen fallbacks para facilitar setup local).
- `DB_USER_PROD`, `DB_PASS_PROD`, `DB_NAME_PROD`, `DB_HOST_PROD` (OBLIGATORIAS en producción): Credenciales para producción. **El servidor NO iniciará en producción si faltan estas variables.**

## Scripts
- `npm start:` Inicia el servidor.
- `npm run dev`: Inicia el servidor en modo desarrollo con nodemon.
- `npm run setup`: Corre el script inicial de setup.
- `npm run db:create`: Crea la base de datos (MySQL).
- `npm run db:migrate`: Aplica las migraciones.
- `npm run db:seed:all`: Carga los seeders.
- `npm run db:reset`: Drop + create + migrate + seed (reset total).
- `npm run lint`: Linta el código y muestra errores/warnings.
- `npm run lint:fix`: Linta y corrige automáticamente los errores de formato que pueda (espacios, comillas, imports, etc).

### Backfill de citas recurrentes (RecurringAppointments)

Este proyecto incluye un script **seguro** para poblar la tabla `RecurringAppointments` a partir de las citas históricas (`Appointments`), pensado para que el CRON pueda empezar a generar citas futuras también para pacientes viejos.

> **IMPORTANTE:** El script **no borra ni modifica** citas existentes. Solo inserta nuevas filas en `RecurringAppointments` y nunca toca las recurrencias que ya existan.

**Requisitos previos:**
- Backend apuntando a la base de datos correcta (staging o producción).
- Migraciones aplicadas: `npm run db:migrate`.
- **Backup de la base** antes de correr en producción.

**Comandos disponibles:**
- `npm run db:backfill-recurring`  
  Ejecuta el script en modo **DRY-RUN** (solo lectura). Muestra por consola qué recurrencias se crearían, pero hace `ROLLBACK` al final y no deja cambios.

- `npm run db:backfill-recurring:apply`  
  Ejecuta el script con `--apply`. Crea efectivamente las filas en `RecurringAppointments` dentro de una transacción. Si algo falla, hace `ROLLBACK` y no se guarda nada.

- `npm run db:backfill-recurring:all`  
  Ejecuta primero el DRY-RUN y luego el `apply` de forma secuencial.

**Opciones avanzadas del script:**
- `--frequency=weekly|biweekly|monthly`  
  Frecuencia por defecto para las recurrencias nuevas (por defecto `weekly` si no se indica).

- `--limit=N`  
  Máximo de pacientes a procesar en esa ejecución (útil para probar con pocos casos, por ejemplo `--limit=50`).

Ejemplos:
- Ver qué pasaría para hasta 50 pacientes, con frecuencia semanal (sin escribir en la BD):
  ```bash
  npm run db:backfill-recurring -- --limit=50 --frequency=weekly
  ```

- Ejecutar en modo seguro completo (recomendado solo después de probar en staging):
  ```bash
  # 1) Ver primero qué haría sobre toda la base
  npm run db:backfill-recurring

  # 2) Si el resultado es correcto, aplicar realmente los cambios
  npm run db:backfill-recurring:apply
  ```

¿Qué hace exactamente?
- Busca pacientes `active` con `professionalId` asignado.
- Si el paciente **no** tiene ninguna `RecurringAppointment` activa:
  - Busca sus citas activas (`Appointments`) con ese profesional.
  - Toma la **última cita cronológica** como `baseAppointment`.
  - Crea una nueva fila en `RecurringAppointments` con `patientId`, `professionalId`, `baseAppointmentId` y la `frequency` indicada.
- Si el paciente ya tiene recurrencias o no tiene citas activas con ese profesional, lo marca como **SKIP** y no toca nada.

Tras correr el backfill con `:apply`, el CRON existente podrá empezar a generar citas futuras para esos pacientes “viejos” igual que para los nuevos.

## Paquetes extras:
- [Funciones Básicas](https://github.com/Scerutti/funciones-basicas)