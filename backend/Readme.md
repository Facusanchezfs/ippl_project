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
- `DB_USER`, `DB_PASS`, `DB_NAME`: Credenciales de base de datos para desarrollo.
- `DB_USER_PROD`, `DB_PASS_PROD`, etc.: Credenciales para producción (sin fallbacks).

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

## Paquetes extras:
- [Funciones Básicas](https://github.com/Scerutti/funciones-basicas)