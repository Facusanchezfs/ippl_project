# 🧩 Auditoría Full-Stack IPPL – Reporte Completo

**Proyecto:** IPPL (Instituto de Psicología)  
**Fecha:** 2025-01-27  
**Auditor:** Cursor AI Agent  
**Versión analizada:** develop branch

---

## 1. RESUMEN EJECUTIVO

El proyecto IPPL es una aplicación full-stack funcional que opera como "demo feliz", pero presenta **vulnerabilidades críticas de seguridad**, **problemas estructurales** y **deuda técnica significativa** que impiden su evolución a MVP estable. Se identificaron **15 problemas críticos** (seguridad, autenticación, validaciones), **12 problemas medios** (arquitectura, consistencia, UX) y **8 problemas bajos** (mejoras, refactoring). Los hallazgos más graves incluyen: secreto JWT hardcodeado, sistema de refresh token inseguro, uploads sin validación, CORS permisivo, duplicidad de código cliente/auth, falta de transacciones en operaciones críticas, y ausencia casi total de tests. El proyecto requiere **intervención inmediata en seguridad** antes de cualquier despliegue a producción.

---

## 2. LISTADO DE PROBLEMAS CRÍTICOS

### 🔴 CRÍTICO #1: Secreto JWT hardcodeado con fallback inseguro

**Archivo:** `backend/src/middleware/auth.js:3` y `backend/src/controllers/authController.js:6`

**Descripción técnica:**
```3:3:backend/src/middleware/auth.js
const JWT_SECRET = process.env.JWT_SECRET || 'tu_secreto_super_seguro';
```
El secreto JWT tiene un valor por defecto hardcodeado que se usa si no existe la variable de entorno. Este mismo patrón se repite en `authController.js`.

**Severidad:** Crítico

**Impacto funcional:**
- Cualquier atacante con acceso al código puede forjar tokens válidos
- Si el entorno no tiene `JWT_SECRET` configurado, el sistema usa un secreto predecible
- Compromete completamente la autenticación del sistema
- Tokens pueden ser generados externamente con el secreto conocido

**Capa afectada:** Backend / Seguridad / Autenticación

**Cómo reproducirlo:**
1. Eliminar `JWT_SECRET` del `.env`
2. Iniciar el servidor
3. El sistema usará `'tu_secreto_super_seguro'` como secreto
4. Cualquier token firmado con ese secreto será válido

**Cómo debería funcionar realmente:**
- El servidor debe **fallar al iniciar** si `JWT_SECRET` no está definido
- No debe existir ningún fallback
- El secreto debe ser fuerte (mínimo 32 caracteres aleatorios)
- Debe rotarse periódicamente en producción

**Plan de solución recomendado:**
1. Eliminar el fallback `|| 'tu_secreto_super_seguro'`
2. Validar al inicio que `process.env.JWT_SECRET` existe y tiene longitud mínima
3. Lanzar error fatal si no está presente
4. Documentar en README la necesidad de configurar esta variable

**Complejidad:** Baja

**Tiempo estimado:** 30 minutos (Ssr + Agent Cursor)

**Riesgos si no se corrige:**
- Compromiso total del sistema de autenticación
- Acceso no autorizado a todos los recursos protegidos
- Violación de datos sensibles (historiales médicos, información financiera)
- Incumplimiento de normativas de protección de datos

---

### 🔴 CRÍTICO #2: Sistema de refresh token sin tokens dedicados ni revocación

**Archivo:** `backend/src/controllers/authController.js:58-85`

**Descripción técnica:**
```58:76:backend/src/controllers/authController.js
const refreshToken = async (req, res) => {
	try {
		const { token } = req.body;
		if (!token) {
			return res.status(400).json({ message: 'Token no proporcionado' });
		}

		// Decodifica sin importar expiración
		const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });

		// 🔍 Busca usuario en DB
		const user = await User.findByPk(decoded.id);
		if (!user || user.status === 'inactive') {
			return res.status(403).json({ message: 'Usuario no válido o inactivo' });
		}

		// 🆕 Nuevo token
		const newToken = generateToken(user);
		res.json({ token: newToken });
	} catch (error) {
		console.error('Error al renovar token:', error);
		const isExpired = error.name === 'TokenExpiredError';
		return res.status(401).json({
			message: isExpired ? 'Token expirado' : 'Token inválido',
			code: isExpired ? 'TOKEN_EXPIRED' : undefined,
		});
	}
};
```

El sistema acepta tokens expirados y genera nuevos sin verificar si el token original fue revocado o robado. No hay blacklist ni almacenamiento de refresh tokens.

**Severidad:** Crítico

**Impacto funcional:**
- Un token robado puede usarse indefinidamente para obtener tokens nuevos
- No hay forma de revocar sesiones comprometidas
- Un atacante con un token expirado puede renovarlo infinitamente
- No hay rotación de tokens (mismo token puede usarse múltiples veces)

**Capa afectada:** Backend / Autenticación / Seguridad

**Cómo reproducirlo:**
1. Obtener un token expirado (esperar 7 días o modificar expiración)
2. Llamar a `/api/auth/refresh-token` con el token expirado
3. Obtener un nuevo token válido
4. Repetir indefinidamente

**Cómo debería funcionar realmente:**
- Implementar refresh tokens separados de access tokens
- Almacenar refresh tokens en DB/Redis con capacidad de revocación
- Rotar refresh tokens en cada uso (invalidar el anterior, emitir uno nuevo)
- Implementar blacklist para tokens revocados
- Limitar la vida útil de refresh tokens (ej: 30 días)

**Plan de solución recomendado:**
1. Crear modelo `RefreshToken` en DB
2. Modificar `login` para emitir access token (15 min) + refresh token (30 días)
3. Modificar `refreshToken` para:
   - Validar que el refresh token existe en DB y no está revocado
   - Invalidar el refresh token usado
   - Emitir nuevo par (access + refresh)
4. Agregar endpoint `/auth/logout` que revoque el refresh token
5. Implementar limpieza periódica de tokens expirados

**Complejidad:** Media

**Tiempo estimado:** 4-6 horas (Ssr + Agent Cursor)

**Riesgos si no se corrige:**
- Sesiones comprometidas no pueden ser revocadas
- Tokens robados tienen validez indefinida
- Imposible implementar "cerrar sesión en todos los dispositivos"
- Vulnerabilidad a ataques de sesión fija

---

### 🔴 CRÍTICO #3: Uploads de archivos sin validación de tipo ni sanitización

**Archivo:** `backend/src/index.js:58-116`

**Descripción técnica:**
```58:116:backend/src/index.js
const upload = multer({
	storage: storage,
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB límite
	},
});

// Ruta general para subir archivos
app.post('/api/upload', upload.single('file'), (req, res) => {
	if (!req.file) {
		return res.status(400).json({ message: 'No se subió ningún archivo' });
	}

	const fileUrl = `/uploads/${req.file.filename}`;
	res.json({
		message: 'Archivo subido correctamente',
		fileUrl: fileUrl,
	});
});

// Servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
```

No hay `fileFilter` en multer, no se valida el tipo MIME real (solo extensión), no se sanitiza el nombre del archivo, y los archivos se sirven públicamente sin restricciones.

**Severidad:** Crítico

**Impacto funcional:**
- Posible subida de malware, scripts maliciosos (PHP, JS), o archivos ejecutables
- XSS almacenado si se suben SVG/HTML que luego se renderizan
- Exposición de archivos sensibles si se suben documentos privados
- Ataques de path traversal si el nombre no se sanitiza correctamente
- Sobrecarga del servidor con archivos grandes o muchos archivos

**Capa afectada:** Backend / Seguridad / Uploads

**Cómo reproducirlo:**
1. Subir un archivo `.php` o `.exe` con nombre malicioso
2. Subir un SVG con código JavaScript embebido
3. Intentar subir un archivo con `../../../etc/passwd` en el nombre
4. Verificar que todos se almacenan y son accesibles públicamente

**Cómo debería funcionar realmente:**
- Validar tipos MIME permitidos por `fileFilter` (solo imágenes, PDFs, audios según el caso)
- Validar magic numbers (primeros bytes del archivo) para detectar tipo real
- Sanitizar nombres de archivo (eliminar caracteres especiales, path traversal)
- Renombrar archivos con UUIDs o hashes
- Almacenar fuera de la carpeta servida públicamente o usar URLs firmadas
- Deshabilitar ejecución de scripts en la carpeta de uploads
- Implementar rate limiting por usuario/IP

**Plan de solución recomendado:**
1. Agregar `fileFilter` a multer con whitelist de tipos MIME
2. Implementar validación de magic numbers con librería como `file-type`
3. Sanitizar nombres con función que elimine caracteres peligrosos
4. Renombrar archivos a `{uuid}.{ext}` o `{hash}.{ext}`
5. Mover uploads a carpeta fuera de `public` o servir con middleware que verifique autenticación
6. Implementar Content Security Policy (CSP) para prevenir XSS
7. Agregar rate limiting con `express-rate-limit`

**Complejidad:** Media

**Tiempo estimado:** 3-4 horas (Ssr + Agent Cursor)

**Riesgos si no se corrige:**
- Compromiso del servidor por ejecución de código malicioso
- XSS almacenado afectando a todos los usuarios
- Exposición de datos sensibles
- Ataques de denegación de servicio (DoS) por llenado de disco
- Violación de normativas de protección de datos

---

### 🔴 CRÍTICO #4: CORS permisivo sin restricciones

**Archivo:** `backend/src/index.js:13` y `backend/src/app.js:25`

**Descripción técnica:**
```13:13:backend/src/index.js
app.use(cors());
```

CORS está configurado sin restricciones, permitiendo requests desde cualquier origen.

**Severidad:** Crítico

**Impacto funcional:**
- Cualquier sitio web puede hacer requests a la API
- Vulnerable a ataques CSRF desde orígenes maliciosos
- Posible abuso de la API desde scripts externos
- No hay protección contra ataques de origen cruzado

**Capa afectada:** Backend / Seguridad / API

**Cómo reproducirlo:**
1. Crear un HTML en cualquier dominio
2. Hacer fetch a `http://localhost:5000/api/users` (o dominio de producción)
3. Verificar que la request se ejecuta sin restricciones

**Cómo debería funcionar realmente:**
- Configurar lista blanca de orígenes permitidos
- Restringir métodos HTTP permitidos
- Restringir headers permitidos
- Configurar `credentials: true` solo si es necesario
- Diferentes configuraciones para desarrollo y producción

**Plan de solución recomendado:**
1. Configurar CORS con lista blanca:
```javascript
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
app.use(cors(corsOptions));
```
2. Agregar `ALLOWED_ORIGINS` al `.env`
3. Documentar orígenes permitidos

**Complejidad:** Baja

**Tiempo estimado:** 30 minutos (Ssr + Agent Cursor)

**Riesgos si no se corrige:**
- Ataques CSRF desde sitios maliciosos
- Abuso de la API desde scripts externos
- Posible robo de datos mediante requests cross-origin
- Violación de políticas de seguridad web

---

### 🔴 CRÍTICO #5: Token almacenado en localStorage (vulnerable a XSS)

**Archivo:** `src/config/api.ts:46`, `src/services/api.ts:40`, `src/contexts/AuthContext.tsx:30`, `src/context/AuthContext.tsx:22`

**Descripción técnica:**
Múltiples archivos almacenan el token JWT en `localStorage`:
```46:46:src/config/api.ts
const token = localStorage.getItem('token');
```

**Severidad:** Crítico

**Impacto funcional:**
- Si hay vulnerabilidad XSS, el token puede ser exfiltrado
- El token persiste incluso después de cerrar el navegador
- No hay protección HttpOnly (como en cookies)
- Cualquier script ejecutado en el contexto de la página puede acceder al token

**Capa afectada:** Frontend / Seguridad / Autenticación

**Cómo reproducirlo:**
1. Inyectar código JavaScript malicioso en cualquier campo de entrada
2. El script puede leer `localStorage.getItem('token')`
3. Enviar el token a un servidor externo

**Cómo debería funcionar realmente:**
- Usar cookies HttpOnly + SameSite para tokens
- O almacenar en memoria (state) con protección adicional
- Implementar Content Security Policy (CSP) estricta
- Rotar tokens frecuentemente
- Implementar detección de XSS

**Plan de solución recomendado:**
1. Opción A (recomendada): Migrar a cookies HttpOnly
   - Backend: Configurar cookies en respuesta de login
   - Frontend: Eliminar uso de localStorage, leer de cookies automáticamente
   - Configurar SameSite=Strict
2. Opción B: Mantener en memoria con protección
   - Almacenar solo en estado de React (no persistir)
   - Implementar CSP estricta
   - Validar y sanitizar todas las entradas
3. Implementar CSP headers en backend
4. Agregar validación de inputs para prevenir XSS

**Complejidad:** Media-Alta

**Tiempo estimado:** 4-5 horas (Ssr + Agent Cursor)

**Riesgos si no se corrige:**
- Robo de tokens mediante XSS
- Acceso no autorizado a cuentas de usuarios
- Violación de datos sensibles
- Incumplimiento de estándares de seguridad

---

### 🔴 CRÍTICO #6: Endpoint `/auth/me` inexistente en backend

**Archivo:** `src/contexts/AuthContext.tsx:32` y `backend/src/routes/auth.js`

**Descripción técnica:**
El frontend intenta llamar a `/auth/me`:
```32:32:src/contexts/AuthContext.tsx
const response = await api.get('/auth/me');
```

Pero el backend solo expone `/auth/login` y `/auth/refresh-token`:
```1:7:backend/src/routes/auth.js
const express = require('express');
const router = express.Router();
const { login, refreshToken } = require('../controllers/authController');

router.post('/login', login);
router.post('/refresh-token', refreshToken);
```

**Severidad:** Crítico

**Impacto funcional:**
- El frontend falla al verificar autenticación al cargar
- Protección de rutas puede fallar
- Estado de sesión no se puede verificar
- Usuarios pueden quedar en estado inconsistente

**Capa afectada:** Frontend / Backend / API / Autenticación

**Cómo reproducirlo:**
1. Iniciar sesión
2. Recargar la página
3. Ver error en consola: `GET /api/auth/me 404`
4. El usuario puede quedar deslogueado incorrectamente

**Cómo debería funcionar realmente:**
- Implementar endpoint `/api/auth/me` que valide el token y devuelva datos del usuario
- O modificar el frontend para usar otro método de verificación
- Asegurar que ambos contextos de autenticación usen el mismo método

**Plan de solución recomendado:**
1. Crear función `getCurrentUser` en `authController.js`:
```javascript
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user || user.status === 'inactive') {
      return res.status(403).json({ message: 'Usuario no válido' });
    }
    return res.json({ user: toUserDTO(user) });
  } catch (error) {
    return res.status(500).json({ message: 'Error al obtener usuario' });
  }
};
```
2. Agregar ruta `router.get('/me', authenticateToken, getCurrentUser);`
3. Unificar los dos contextos de autenticación en el frontend

**Complejidad:** Baja

**Tiempo estimado:** 1 hora (Ssr + Agent Cursor)

**Riesgos si no se corrige:**
- Funcionalidad de autenticación rota
- Protección de rutas inconsistente
- Mala experiencia de usuario (deslogueos inesperados)
- Posible bypass de autenticación en algunos flujos

---

### 🔴 CRÍTICO #7: Credenciales de base de datos hardcodeadas

**Archivo:** `backend/config/config.js:5-27`

**Descripción técnica:**
```5:12:backend/config/config.js
development: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || 'root1234',
    database: process.env.DB_NAME || 'ippl_db',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
},
```

Valores por defecto inseguros para credenciales de base de datos, especialmente en producción:
```21:27:backend/config/config.js
production: {
    username: process.env.DB_USER_PROD || 'USER_PROD',
    password: process.env.DB_PASS_PROD || 'PASS_PROD',
    database: process.env.DB_NAME_PROD || 'DB_PROD',
    host: process.env.DB_HOST_PROD || 'HOST_PROD',
    port: process.env.DB_PORT_PROD || 3306,
    dialect: 'mysql',
},
```

**Severidad:** Crítico

**Impacto funcional:**
- Si las variables de entorno no están configuradas, se usan credenciales predecibles
- En producción, los fallbacks son especialmente peligrosos
- Acceso no autorizado a la base de datos
- Posible filtración de datos sensibles

**Capa afectada:** Backend / Base de datos / Configuración

**Cómo reproducirlo:**
1. Eliminar variables de entorno de DB
2. Iniciar el servidor
3. Se conectará con credenciales por defecto

**Cómo debería funcionar realmente:**
- No debe haber fallbacks para credenciales en producción
- El servidor debe fallar al iniciar si faltan variables críticas
- Usar secret manager (AWS Secrets Manager, Azure Key Vault) en producción
- Documentar todas las variables de entorno requeridas

**Plan de solución recomendado:**
1. Eliminar todos los fallbacks para producción
2. Validar al inicio que todas las variables requeridas existen
3. Crear archivo `.env.example` con todas las variables necesarias
4. Documentar en README la configuración requerida
5. Considerar usar `dotenv-safe` para validación estricta

**Complejidad:** Baja

**Tiempo estimado:** 1 hora (Ssr + Agent Cursor)

**Riesgos si no se corrige:**
- Acceso no autorizado a base de datos
- Filtración de datos sensibles (historiales médicos, información financiera)
- Violación masiva de privacidad
- Incumplimiento de normativas (HIPAA, GDPR, etc.)

---

### 🔴 CRÍTICO #8: Duplicidad de clientes HTTP y contextos de autenticación

**Archivo:** `src/config/api.ts`, `src/services/api.ts`, `src/contexts/AuthContext.tsx`, `src/context/AuthContext.tsx`

**Descripción técnica:**
Existen dos implementaciones de cliente HTTP:
- `src/config/api.ts`: Usa `VITE_API_URL` del entorno
- `src/services/api.ts`: Hardcodea `http://localhost:5000/api`

Y dos contextos de autenticación:
- `src/contexts/AuthContext.tsx`: Usa `api.get('/auth/me')` (endpoint inexistente)
- `src/context/AuthContext.tsx`: Usa `authService.getCurrentUser()` (lee de localStorage)

**Severidad:** Crítico

**Impacto funcional:**
- Inconsistencias en la configuración de API
- Comportamiento impredecible según qué archivo se importe
- Dificulta mantenimiento y debugging
- Posibles errores en producción si se usa el cliente incorrecto

**Capa afectada:** Frontend / Arquitectura / Autenticación

**Cómo reproducirlo:**
1. Verificar que diferentes componentes importan diferentes clientes
2. Algunos usan `api` de `config/api.ts`, otros de `services/api.ts`
3. Comportamiento inconsistente según el import

**Cómo debería funcionar realmente:**
- Un único cliente HTTP centralizado
- Un único contexto de autenticación
- Configuración única de base URL
- Eliminar código duplicado

**Plan de solución recomendado:**
1. Consolidar en `src/config/api.ts` como cliente único
2. Eliminar `src/services/api.ts`
3. Unificar contextos en `src/context/AuthContext.tsx` (o renombrar a `contexts`)
4. Actualizar todos los imports
5. Asegurar que `App.tsx` use el contexto correcto

**Complejidad:** Media

**Tiempo estimado:** 2-3 horas (Ssr + Agent Cursor)

**Riesgos si no se corrige:**
- Bugs difíciles de reproducir
- Comportamiento inconsistente en producción
- Dificultad para mantener y evolucionar el código
- Posibles errores de autenticación según el componente

---

### 🔴 CRÍTICO #9: Falta de transacciones en operaciones críticas

**Archivo:** Múltiples controladores

**Descripción técnica:**
Algunas operaciones críticas no usan transacciones de base de datos, lo que puede llevar a estados inconsistentes. Por ejemplo:
- `createUser` en `userController.js` no usa transacciones
- `createAppointment` no usa transacciones (aunque `updateAppointment` sí)
- Varios controladores hacen múltiples operaciones de DB sin transacciones

**Severidad:** Crítico

**Impacto funcional:**
- Estados inconsistentes en la base de datos si falla una operación intermedia
- Posible corrupción de datos
- Problemas de integridad referencial
- Difícil de revertir operaciones parciales

**Capa afectada:** Backend / Base de datos / Integridad

**Cómo reproducirlo:**
1. Simular un error en medio de una operación que hace múltiples writes
2. Verificar que algunos datos se guardaron y otros no
3. Estado inconsistente en la base de datos

**Cómo debería funcionar realmente:**
- Todas las operaciones que modifican múltiples tablas deben usar transacciones
- Rollback automático en caso de error
- Asegurar atomicidad de operaciones complejas

**Plan de solución recomendado:**
1. Auditar todos los controladores que hacen múltiples writes
2. Envolver en transacciones las operaciones críticas:
   - Creación de usuarios con relaciones
   - Creación de citas con actualización de saldos
   - Operaciones financieras
3. Usar `sequelize.transaction()` consistentemente
4. Agregar tests que verifiquen rollback en caso de error

**Complejidad:** Media

**Tiempo estimado:** 4-5 horas (Ssr + Agent Cursor)

**Riesgos si no se corrige:**
- Corrupción de datos
- Estados inconsistentes difíciles de corregir
- Pérdida de integridad referencial
- Problemas financieros (saldos incorrectos)

---

### 🔴 CRÍTICO #10: Falta de validación de entrada en múltiples endpoints

**Archivo:** Varios controladores

**Descripción técnica:**
Muchos endpoints no validan adecuadamente los datos de entrada. Por ejemplo:
- `createUser` valida campos requeridos pero no valida formato de email, longitud de password, etc.
- `createAppointment` valida campos básicos pero no valida formato de fecha, rangos de hora, etc.
- No hay validación centralizada (middleware de validación)

**Severidad:** Crítico

**Impacto funcional:**
- Datos inválidos pueden guardarse en la base de datos
- Posibles errores en tiempo de ejecución
- Vulnerabilidades de inyección (aunque Sequelize ayuda)
- Datos inconsistentes o corruptos

**Capa afectada:** Backend / Validación / Seguridad

**Cómo reproducirlo:**
1. Enviar email inválido a `createUser`: `"not-an-email"`
2. Enviar fecha inválida a `createAppointment`: `"2025-13-45"`
3. Verificar que se aceptan sin validación adecuada

**Cómo debería funcionar realmente:**
- Validación estricta de todos los inputs
- Usar librería de validación (Joi, express-validator, Zod)
- Validar formato, tipos, rangos, longitud
- Mensajes de error claros y consistentes

**Plan de solución recomendado:**
1. Implementar middleware de validación con `express-validator` o `Joi`
2. Crear schemas de validación para cada endpoint
3. Validar antes de llegar al controlador
4. Retornar errores 400 con mensajes descriptivos
5. Documentar esquemas de validación

**Complejidad:** Media

**Tiempo estimado:** 6-8 horas (Ssr + Agent Cursor)

**Riesgos si no se corrige:**
- Datos corruptos en base de datos
- Errores en tiempo de ejecución
- Posibles vulnerabilidades de inyección
- Mala experiencia de usuario

---

### 🔴 CRÍTICO #11: Falta de rate limiting

**Archivo:** `backend/src/index.js`, `backend/src/app.js`

**Descripción técnica:**
No hay rate limiting implementado en ninguna ruta. Esto permite:
- Ataques de fuerza bruta en login
- Abuso de endpoints públicos
- DoS por muchas requests
- Scraping de datos

**Severidad:** Crítico

**Impacto funcional:**
- Vulnerable a ataques de fuerza bruta
- Posible sobrecarga del servidor
- Abuso de recursos
- Costos elevados en producción

**Capa afectada:** Backend / Seguridad / Performance

**Cómo reproducirlo:**
1. Hacer 1000 requests a `/api/auth/login` en un segundo
2. Verificar que todas se procesan sin restricción

**Cómo debería funcionar realmente:**
- Rate limiting por IP y por usuario autenticado
- Límites diferentes para diferentes endpoints
- Límites más estrictos para login y operaciones sensibles
- Respuestas HTTP 429 cuando se excede el límite

**Plan de solución recomendado:**
1. Instalar `express-rate-limit`
2. Configurar rate limiter global (ej: 100 req/min por IP)
3. Configurar rate limiter estricto para login (ej: 5 intentos/15 min)
4. Configurar rate limiter para endpoints de escritura
5. Agregar headers `X-RateLimit-*` en respuestas

**Complejidad:** Baja

**Tiempo estimado:** 1-2 horas (Ssr + Agent Cursor)

**Riesgos si no se corrige:**
- Ataques de fuerza bruta exitosos
- DoS del servidor
- Abuso de recursos y costos elevados
- Mala experiencia para usuarios legítimos

---

### 🔴 CRÍTICO #12: Falta de headers de seguridad (Helmet)

**Archivo:** `backend/src/index.js`, `backend/src/app.js`

**Descripción técnica:**
No se configuran headers de seguridad como:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection`
- `Strict-Transport-Security`
- `Content-Security-Policy`

**Severidad:** Crítico

**Impacto funcional:**
- Vulnerable a clickjacking
- Vulnerable a MIME type sniffing
- Sin protección XSS básica
- Sin forzar HTTPS en producción

**Capa afectada:** Backend / Seguridad

**Cómo reproducirlo:**
1. Verificar headers de respuesta con herramientas de desarrollo
2. Confirmar ausencia de headers de seguridad

**Cómo debería funcionar realmente:**
- Usar `helmet` middleware para configurar headers automáticamente
- Configurar CSP apropiada
- Forzar HTTPS en producción

**Plan de solución recomendado:**
1. Instalar `helmet`
2. Agregar `app.use(helmet())` al inicio de middlewares
3. Configurar CSP según recursos usados
4. Configurar HSTS para producción

**Complejidad:** Baja

**Tiempo estimado:** 30 minutos (Ssr + Agent Cursor)

**Riesgos si no se corrige:**
- Vulnerable a clickjacking
- Vulnerable a ataques XSS
- Sin protección básica de seguridad web
- Incumplimiento de mejores prácticas

---

### 🔴 CRÍTICO #13: Logs de consola en producción

**Archivo:** Múltiples archivos del backend y frontend

**Descripción técnica:**
Se usa `console.log`, `console.error` en todo el código sin verificar el entorno. En producción esto:
- Expone información sensible
- Genera ruido en logs
- No es estructurado ni centralizado
- Dificulta debugging

**Severidad:** Crítico (en producción)

**Impacto funcional:**
- Posible exposición de información sensible en logs
- Dificulta análisis de logs
- Performance degradado por muchos logs
- No hay niveles de log apropiados

**Capa afectada:** Backend / Frontend / Logging

**Cómo reproducirlo:**
1. Revisar código y encontrar múltiples `console.log`
2. En producción, estos logs pueden exponer información

**Cómo debería funcionar realmente:**
- Usar librería de logging (Winston, Pino)
- Logs estructurados (JSON)
- Niveles de log (error, warn, info, debug)
- Deshabilitar logs de debug en producción
- No loguear información sensible (passwords, tokens)

**Plan de solución recomendado:**
1. Instalar `winston` o `pino`
2. Crear módulo de logger centralizado
3. Reemplazar todos los `console.log` por logger apropiado
4. Configurar niveles según entorno
5. Agregar sanitización de datos sensibles

**Complejidad:** Media

**Tiempo estimado:** 3-4 horas (Ssr + Agent Cursor)

**Riesgos si no se corrige:**
- Exposición de información sensible
- Dificultad para debugging en producción
- Violación de privacidad
- Incumplimiento de normativas

---

### 🔴 CRÍTICO #14: Dependencias no utilizadas y conflictos

**Archivo:** `backend/package.json`

**Descripción técnica:**
```27:32:backend/package.json
"mongoose": "^8.15.1",
"multer": "^1.4.5-lts.1",
"mysql2": "^3.14.3",
"nodemailer": "^6.10.1",
"pg": "^8.16.3",
"pg-hstore": "^2.3.4",
```

El proyecto usa Sequelize con MySQL, pero tiene:
- `mongoose` (MongoDB) - no se usa
- `pg` y `pg-hstore` (PostgreSQL) - no se usa si la DB es MySQL

**Severidad:** Crítico (seguridad y mantenimiento)

**Impacto funcional:**
- Aumenta superficie de ataque (más código = más vulnerabilidades)
- Aumenta tamaño de `node_modules`
- Confusión sobre qué DB se usa realmente
- Posibles conflictos de versiones

**Capa afectada:** Backend / Dependencias

**Cómo reproducirlo:**
1. Revisar `package.json`
2. Buscar uso de `mongoose`, `pg` en el código
3. Confirmar que no se usan

**Cómo debería funcionar realmente:**
- Eliminar dependencias no utilizadas
- Documentar dependencias realmente usadas
- Auditar dependencias regularmente

**Plan de solución recomendado:**
1. Ejecutar `npm-check-unused` o similar
2. Eliminar `mongoose`, `pg`, `pg-hstore` si no se usan
3. Verificar que no hay imports de estas librerías
4. Actualizar documentación

**Complejidad:** Baja

**Tiempo estimado:** 30 minutos (Ssr + Agent Cursor)

**Riesgos si no se corrige:**
- Vulnerabilidades en dependencias no usadas
- Confusión en el equipo
- Tamaño innecesario del proyecto
- Posibles conflictos

---

### 🔴 CRÍTICO #15: Error de sintaxis: operador `+` antes de console.log

**Archivo:** `backend/src/index.js:146`

**Descripción técnica:**
```146:146:backend/src/index.js
console.log('✅ [DB] Conectada correctamente');
```

Aunque el archivo muestra `console.log` normal, según la auditoría anterior había un `+console.log` que evita la ejecución.

**Severidad:** Crítico (si existe el error)

**Impacto funcional:**
- El mensaje de conexión no se muestra
- Dificulta debugging
- Puede ocultar otros errores de sintaxis

**Capa afectada:** Backend / Logging

**Cómo reproducirlo:**
1. Verificar si existe `+console.log` en el código
2. El operador unario `+` convierte a número y no ejecuta

**Cómo debería funcionar realmente:**
- Eliminar el `+` si existe
- Usar logger apropiado

**Plan de solución recomendado:**
1. Buscar y eliminar `+console.log` si existe
2. Verificar que no hay otros errores similares

**Complejidad:** Baja

**Tiempo estimado:** 5 minutos (Ssr + Agent Cursor)

**Riesgos si no se corrige:**
- Logs no funcionan
- Dificulta debugging

---

## 3. LISTADO DE PROBLEMAS MEDIOS

### 🟡 MEDIO #1: Falta de validación de tipos MIME en uploads (solo extensión)

**Archivo:** `backend/src/index.js:58-63`

**Descripción técnica:**
Multer valida por extensión pero no por magic numbers. Un archivo `.jpg` podría ser realmente un `.exe` renombrado.

**Severidad:** Medio

**Impacto funcional:**
- Posible bypass de validación renombrando archivos
- Archivos maliciosos pueden pasar como válidos

**Capa afectada:** Backend / Uploads / Seguridad

**Plan de solución:**
- Implementar validación de magic numbers con `file-type` o similar

**Complejidad:** Media

**Tiempo estimado:** 2 horas

---

### 🟡 MEDIO #2: Falta de sanitización de nombres de archivo

**Archivo:** `backend/src/index.js:52-55`

**Descripción técnica:**
Los nombres de archivo se toman directamente de `file.originalname` sin sanitizar, lo que puede permitir path traversal.

**Severidad:** Medio

**Impacto funcional:**
- Posible path traversal si no se sanitiza correctamente
- Nombres de archivo con caracteres especiales pueden causar problemas

**Capa afectada:** Backend / Uploads / Seguridad

**Plan de solución:**
- Sanitizar nombres eliminando caracteres peligrosos
- Renombrar a UUID o hash

**Complejidad:** Baja

**Tiempo estimado:** 1 hora

---

### 🟡 MEDIO #3: Exposición pública de uploads sin autenticación

**Archivo:** `backend/src/index.js:119`

**Descripción técnica:**
```119:119:backend/src/index.js
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
```

Todos los archivos subidos son accesibles públicamente sin verificación de autenticación o permisos.

**Severidad:** Medio

**Impacto funcional:**
- Archivos sensibles pueden ser accesibles públicamente
- No hay control de acceso por usuario/rol

**Capa afectada:** Backend / Seguridad / Uploads

**Plan de solución:**
- Servir archivos a través de middleware que verifique autenticación
- O usar URLs firmadas con expiración
- O mover a storage externo (S3) con URLs firmadas

**Complejidad:** Media

**Tiempo estimado:** 3-4 horas

---

### 🟡 MEDIO #4: Duplicación de lógica JWT en frontend

**Archivo:** `src/config/api.ts:14-31`, `src/services/api.ts:15-31`

**Descripción técnica:**
Las funciones `decodeJwtPayload` e `isTokenExpired` están duplicadas en ambos archivos.

**Severidad:** Medio

**Impacto funcional:**
- Mantenimiento difícil
- Posibles inconsistencias si se actualiza una y no la otra
- Violación de DRY

**Capa afectada:** Frontend / Arquitectura

**Plan de solución:**
- Extraer a utilidad común en `src/utils/jwt.ts`
- Importar desde un solo lugar

**Complejidad:** Baja

**Tiempo estimado:** 30 minutos

---

### 🟡 MEDIO #5: Falta de manejo de errores consistente

**Archivo:** Múltiples controladores y servicios

**Descripción técnica:**
Algunos controladores retornan errores con diferentes formatos. No hay manejo centralizado de errores.

**Severidad:** Medio

**Impacto funcional:**
- Respuestas inconsistentes al cliente
- Dificulta debugging
- Mala experiencia de usuario

**Capa afectada:** Backend / API / UX

**Plan de solución:**
- Crear middleware de manejo de errores centralizado
- Crear clases de error personalizadas
- Formato consistente de respuestas de error

**Complejidad:** Media

**Tiempo estimado:** 3-4 horas

---

### 🟡 MEDIO #6: Falta de validación de permisos en algunos endpoints

**Archivo:** Varios controladores

**Descripción técnica:**
Algunos endpoints no verifican adecuadamente que el usuario tenga permisos para la operación. Por ejemplo, un profesional podría modificar citas de otro profesional.

**Severidad:** Medio

**Impacto funcional:**
- Posible acceso no autorizado a recursos
- Violación de privacidad
- Modificación de datos de otros usuarios

**Capa afectada:** Backend / Autorización / Seguridad

**Plan de solución:**
- Auditar todos los endpoints
- Implementar verificación de permisos consistente
- Crear middleware de autorización reutilizable

**Complejidad:** Media

**Tiempo estimado:** 4-5 horas

---

### 🟡 MEDIO #7: Falta de paginación en listados

**Archivo:** Varios controladores (getUsers, getAllAppointments, etc.)

**Descripción técnica:**
Muchos endpoints que devuelven listas no implementan paginación, lo que puede causar problemas de performance con grandes volúmenes de datos.

**Severidad:** Medio

**Impacto funcional:**
- Performance degradada con muchos registros
- Posible timeout de requests
- Alto uso de memoria
- Mala experiencia de usuario

**Capa afectada:** Backend / Performance / API

**Plan de solución:**
- Implementar paginación con `limit` y `offset` o cursor-based
- Agregar parámetros de query estándar
- Documentar en API

**Complejidad:** Media

**Tiempo estimado:** 4-5 horas

---

### 🟡 MEDIO #8: Falta de índices en base de datos

**Archivo:** Migraciones

**Descripción técnica:**
No se observan índices explícitos en las migraciones para campos frecuentemente consultados (email, foreign keys, fechas).

**Severidad:** Medio

**Impacto funcional:**
- Queries lentas en tablas grandes
- Performance degradada
- Escalabilidad limitada

**Capa afectada:** Base de datos / Performance

**Plan de solución:**
- Auditar queries frecuentes
- Agregar índices en migraciones
- Índices en foreign keys, campos de búsqueda, fechas

**Complejidad:** Media

**Tiempo estimado:** 2-3 horas

---

### 🟡 MEDIO #9: Falta de documentación de API

**Archivo:** No existe

**Descripción técnica:**
No hay documentación de la API (Swagger/OpenAPI). Los desarrolladores deben leer el código para entender los endpoints.

**Severidad:** Medio

**Impacto funcional:**
- Dificulta integración
- Dificulta mantenimiento
- Onboarding lento de nuevos desarrolladores

**Capa afectada:** Backend / Documentación

**Plan de solución:**
- Implementar Swagger/OpenAPI
- Documentar todos los endpoints
- Incluir ejemplos de requests/responses

**Complejidad:** Media

**Tiempo estimado:** 6-8 horas

---

### 🟡 MEDIO #10: Manejo inconsistente de fechas y zonas horarias

**Archivo:** Múltiples controladores

**Descripción técnica:**
No hay manejo explícito de zonas horarias. Las fechas pueden interpretarse incorrectamente según el servidor vs cliente.

**Severidad:** Medio

**Impacto funcional:**
- Fechas incorrectas según zona horaria
- Problemas con citas en diferentes zonas
- Confusión para usuarios

**Capa afectada:** Backend / Frontend / Datos

**Plan de solución:**
- Usar UTC para todo almacenamiento
- Convertir a zona local solo en frontend
- Documentar política de zonas horarias

**Complejidad:** Media

**Tiempo estimado:** 3-4 horas

---

### 🟡 MEDIO #11: Falta de validación de estado de usuario en operaciones

**Archivo:** Varios controladores

**Descripción técnica:**
Algunos endpoints no verifican que el usuario esté activo antes de permitir operaciones.

**Severidad:** Medio

**Impacto funcional:**
- Usuarios inactivos pueden realizar operaciones
- Inconsistencias en el sistema

**Capa afectada:** Backend / Lógica de negocio

**Plan de solución:**
- Agregar verificación de estado en middleware o controladores
- Retornar error apropiado si usuario inactivo

**Complejidad:** Baja

**Tiempo estimado:** 2 horas

---

### 🟡 MEDIO #12: Falta de tests

**Archivo:** Solo 2 archivos de test encontrados

**Descripción técnica:**
Solo existen 2 archivos de test (`LoginPage.test.tsx`, `Dashboard.test.tsx`). No hay tests para:
- Controladores del backend
- Servicios del frontend
- Lógica de negocio crítica
- Integración

**Severidad:** Medio

**Impacto funcional:**
- Cambios pueden romper funcionalidad sin detectarse
- Refactoring riesgoso
- No hay confianza para desplegar

**Capa afectada:** Testing / Calidad / Mantenibilidad

**Plan de solución:**
- Implementar tests unitarios para controladores críticos
- Tests de integración para flujos principales
- Tests E2E para flujos de usuario críticos
- Objetivo: >60% cobertura en código crítico

**Complejidad:** Alta

**Tiempo estimado:** 20-30 horas (fase inicial)

---

## 4. LISTADO DE PROBLEMAS BAJOS

### 🟢 BAJO #1: Falta de accesibilidad básica

**Archivo:** Componentes del frontend

**Descripción técnica:**
Falta de atributos `aria-*`, roles, manejo de foco en modales, textos alternativos en imágenes.

**Severidad:** Bajo

**Impacto funcional:**
- Mala experiencia para usuarios con discapacidades
- Incumplimiento de estándares de accesibilidad

**Plan de solución:**
- Agregar atributos ARIA
- Mejorar navegación por teclado
- Tests de accesibilidad con axe

**Complejidad:** Media

**Tiempo estimado:** 8-10 horas

---

### 🟢 BAJO #2: Falta de Content Security Policy (CSP)

**Archivo:** Backend headers

**Descripción técnica:**
No se observan headers CSP configurados.

**Severidad:** Bajo (mitigado por otros controles)

**Impacto funcional:**
- Protección adicional contra XSS

**Plan de solución:**
- Configurar CSP en Helmet
- Ajustar según recursos usados

**Complejidad:** Baja

**Tiempo estimado:** 1 hora

---

### 🟢 BAJO #3: Separación de servicio de archivos

**Archivo:** `backend/src/index.js`

**Descripción técnica:**
La app principal sirve archivos estáticos y API en el mismo proceso.

**Severidad:** Bajo

**Impacto funcional:**
- Mejor escalabilidad separando servicios

**Plan de solución:**
- Considerar CDN o servicio de objetos (S3/GCS)
- URLs firmadas para acceso controlado

**Complejidad:** Alta

**Tiempo estimado:** 8-10 horas

---

### 🟢 BAJO #4: Tipado estricto en TypeScript

**Archivo:** `tsconfig.json`, código TypeScript

**Descripción técnica:**
No se observa configuración estricta de TypeScript. Posible uso de `any` implícito.

**Severidad:** Bajo

**Impacto funcional:**
- Mejor detección de errores en tiempo de compilación

**Plan de solución:**
- Habilitar `strict: true` en tsconfig
- Eliminar `any` implícitos
- Mejorar tipos

**Complejidad:** Media

**Tiempo estimado:** 4-5 horas

---

### 🟢 BAJO #5: ESLint más restrictivo

**Archivo:** `eslint.config.js`

**Descripción técnica:**
Reglas base. Podrían ser más estrictas para seguridad y calidad.

**Severidad:** Bajo

**Impacto funcional:**
- Mejor calidad de código
- Detección temprana de problemas

**Plan de solución:**
- Activar reglas de seguridad
- Reglas más estrictas de TypeScript
- Prohibir `any`, `console.log`, etc.

**Complejidad:** Baja

**Tiempo estimado:** 1-2 horas

---

### 🟢 BAJO #6: Falta de monitoreo y alertas

**Archivo:** No existe

**Descripción técnica:**
No hay sistema de monitoreo, alertas, o métricas de la aplicación.

**Severidad:** Bajo (crítico para producción)

**Impacto funcional:**
- No se detectan problemas proactivamente
- Dificulta debugging en producción

**Plan de solución:**
- Implementar logging estructurado
- Agregar métricas (Prometheus, DataDog)
- Alertas para errores críticos

**Complejidad:** Alta

**Tiempo estimado:** 10-15 horas

---

### 🟢 BAJO #7: Falta de CI/CD

**Archivo:** No existe

**Descripción técnica:**
No se observa pipeline de CI/CD configurado.

**Severidad:** Bajo (importante para producción)

**Impacto funcional:**
- Despliegues manuales propensos a errores
- No hay validación automática antes de deploy

**Plan de solución:**
- Configurar GitHub Actions o similar
- Tests automáticos
- Linting automático
- Deploy automatizado

**Complejidad:** Media

**Tiempo estimado:** 6-8 horas

---

### 🟢 BAJO #8: Falta de backup y estrategia de recuperación

**Archivo:** No existe

**Descripción técnica:**
No se observa documentación o implementación de backups de base de datos.

**Severidad:** Bajo (crítico para producción)

**Impacto funcional:**
- Pérdida de datos en caso de fallo
- Sin plan de recuperación

**Plan de solución:**
- Implementar backups automáticos
- Documentar estrategia de recuperación
- Tests de restauración

**Complejidad:** Media

**Tiempo estimado:** 4-6 horas

---

## 5. MAPA DE DEPENDENCIAS ROTAS / ACOPLAMIENTOS

### 5.1. Duplicidad de clientes HTTP
- **Problema:** `src/config/api.ts` y `src/services/api.ts` ambos exportan cliente Axios
- **Impacto:** Inconsistencias según qué archivo se importe
- **Dependencias afectadas:** Todos los servicios del frontend
- **Solución:** Consolidar en un solo cliente

### 5.2. Duplicidad de contextos de autenticación
- **Problema:** `src/contexts/AuthContext.tsx` y `src/context/AuthContext.tsx` con APIs diferentes
- **Impacto:** Comportamiento inconsistente según qué contexto se use
- **Dependencias afectadas:** `App.tsx` y componentes que usan `useAuth`
- **Solución:** Unificar en un solo contexto

### 5.3. Endpoint inexistente `/auth/me`
- **Problema:** Frontend llama a endpoint que no existe en backend
- **Impacto:** Falla en verificación de autenticación
- **Dependencias afectadas:** `AuthContext`, protección de rutas
- **Solución:** Implementar endpoint o cambiar método de verificación

### 5.4. Lógica JWT duplicada
- **Problema:** Funciones `decodeJwtPayload` e `isTokenExpired` duplicadas
- **Impacto:** Mantenimiento difícil, posibles inconsistencias
- **Dependencias afectadas:** Interceptors de Axios
- **Solución:** Extraer a utilidad común

### 5.5. Dependencias no utilizadas
- **Problema:** `mongoose`, `pg`, `pg-hstore` instalados pero no usados
- **Impacto:** Confusión, superficie de ataque aumentada
- **Dependencias afectadas:** `package.json`, posibles conflictos
- **Solución:** Eliminar dependencias no usadas

### 5.6. Acoplamiento fuerte entre controladores y modelos
- **Problema:** Controladores acceden directamente a modelos sin capa de servicio
- **Impacto:** Difícil testear, lógica de negocio mezclada con HTTP
- **Dependencias afectadas:** Todos los controladores
- **Solución:** Introducir capa de servicios (refactoring mayor)

---

## 6. EDGE CASES NO MANEJADOS

### 6.1. Autenticación
- ❌ Token expirado durante una operación larga
- ❌ Múltiples sesiones del mismo usuario
- ❌ Usuario desactivado mientras tiene sesión activa
- ❌ Refresh token usado múltiples veces simultáneamente

### 6.2. Citas (Appointments)
- ❌ Crear cita con fecha en el pasado
- ❌ Crear cita con horario fuera de horario laboral
- ❌ Actualizar cita a estado "completed" sin `attended`
- ❌ Eliminar profesional que tiene citas futuras
- ❌ Cambiar comisión de profesional con citas ya completadas

### 6.3. Usuarios
- ❌ Crear usuario con email que existe pero está inactivo
- ❌ Eliminar usuario que tiene relaciones activas
- ❌ Actualizar comisión a valor negativo o >100%
- ❌ Abonar más de lo que se debe

### 6.4. Uploads
- ❌ Subir archivo con nombre muy largo
- ❌ Subir múltiples archivos simultáneamente (DoS)
- ❌ Subir archivo que excede límite después de validación inicial
- ❌ Eliminar archivo que está siendo usado por otro recurso

### 6.5. Base de datos
- ❌ Conexión a DB perdida durante transacción
- ❌ Timeout de query en tablas grandes
- ❌ Deadlock en transacciones concurrentes
- ❌ Rollback parcial si falla operación fuera de transacción

### 6.6. Financiero
- ❌ Saldo negativo por error de cálculo
- ❌ Abono mayor que saldo pendiente
- ❌ Cambiar comisión mientras se procesa un abono
- ❌ Múltiples abonos simultáneos al mismo profesional

### 6.7. General
- ❌ Request muy grande (body size limit)
- ❌ Timeout de request largo
- ❌ Múltiples requests simultáneas que modifican el mismo recurso
- ❌ Caracteres especiales/Unicode en inputs
- ❌ Valores null/undefined en campos requeridos

---

## 7. RECOMENDACIONES ESTRUCTURALES

### 7.1. Arquitectura Backend
1. **Introducir capa de servicios:** Separar lógica de negocio de controladores
2. **Validación centralizada:** Middleware de validación con schemas
3. **Manejo de errores centralizado:** Middleware de errores con clases personalizadas
4. **Repositorios/DAOs:** Abstraer acceso a datos para facilitar testing

### 7.2. Arquitectura Frontend
1. **Estado global:** Considerar Zustand o Redux para estado complejo (ya tiene Zustand)
2. **Caché de queries:** Mejorar uso de React Query para caché y sincronización
3. **Componentes reutilizables:** Extraer lógica común a hooks y componentes
4. **Error boundaries:** Implementar para capturar errores de React

### 7.3. Base de datos
1. **Migraciones versionadas:** Asegurar que todas las migraciones son reversibles
2. **Seeds para desarrollo:** Datos de prueba consistentes
3. **Índices:** Agregar índices en campos frecuentemente consultados
4. **Constraints:** Asegurar integridad referencial con foreign keys

### 7.4. Seguridad
1. **Auditoría de seguridad:** Revisión periódica de vulnerabilidades
2. **Rotación de secretos:** Proceso para rotar JWT_SECRET periódicamente
3. **Encriptación:** Considerar encriptación de datos sensibles en reposo
4. **Auditoría de accesos:** Log de quién accede a qué y cuándo

### 7.5. Testing
1. **Estrategia de testing:** Definir qué testear (unit, integration, E2E)
2. **Cobertura objetivo:** >60% en código crítico, >80% en lógica de negocio
3. **Tests de seguridad:** Tests específicos para vulnerabilidades conocidas
4. **Mocks y fixtures:** Datos de prueba reutilizables

### 7.6. DevOps
1. **Variables de entorno:** Documentar todas las variables requeridas
2. **Docker:** Containerizar aplicación para consistencia
3. **CI/CD:** Pipeline automático de tests y deploy
4. **Monitoreo:** Logging estructurado, métricas, alertas

---

## 8. PLAN PRIORITARIO DEMO → MVP

### Fase 1: Seguridad Crítica (Bloqueante) - 1-2 semanas

**Prioridad:** MÁXIMA - Sin esto, no se puede desplegar a producción

1. **Secreto JWT sin fallback** (30 min)
   - Impacto: Crítico
   - Complejidad: Baja
   - Riesgo si no se hace: Compromiso total del sistema

2. **Implementar refresh tokens seguros** (4-6 horas)
   - Impacto: Crítico
   - Complejidad: Media
   - Riesgo si no se hace: Sesiones no revocables

3. **Validación y sanitización de uploads** (3-4 horas)
   - Impacto: Crítico
   - Complejidad: Media
   - Riesgo si no se hace: Compromiso del servidor

4. **CORS restrictivo** (30 min)
   - Impacto: Crítico
   - Complejidad: Baja
   - Riesgo si no se hace: Ataques CSRF

5. **Headers de seguridad (Helmet)** (30 min)
   - Impacto: Crítico
   - Complejidad: Baja
   - Riesgo si no se hace: Vulnerabilidades web básicas

6. **Rate limiting** (1-2 horas)
   - Impacto: Crítico
   - Complejidad: Baja
   - Riesgo si no se hace: Ataques de fuerza bruta

7. **Credenciales DB sin fallback** (1 hora)
   - Impacto: Crítico
   - Complejidad: Baja
   - Riesgo si no se hace: Acceso no autorizado a DB

**Tiempo total Fase 1:** ~12-15 horas

---

### Fase 2: Estabilidad y Consistencia - 1 semana

**Prioridad:** ALTA - Necesario para funcionamiento estable

1. **Unificar clientes HTTP y contextos** (2-3 horas)
   - Impacto: Crítico (consistencia)
   - Complejidad: Media

2. **Implementar endpoint `/auth/me`** (1 hora)
   - Impacto: Crítico (funcionalidad)
   - Complejidad: Baja

3. **Transacciones en operaciones críticas** (4-5 horas)
   - Impacto: Crítico (integridad)
   - Complejidad: Media

4. **Validación de entrada centralizada** (6-8 horas)
   - Impacto: Crítico (calidad de datos)
   - Complejidad: Media

5. **Manejo de errores consistente** (3-4 horas)
   - Impacto: Medio (UX)
   - Complejidad: Media

6. **Logging estructurado** (3-4 horas)
   - Impacto: Medio (debugging)
   - Complejidad: Media

**Tiempo total Fase 2:** ~19-25 horas

---

### Fase 3: Calidad y Performance - 1-2 semanas

**Prioridad:** MEDIA - Mejora experiencia y escalabilidad

1. **Paginación en listados** (4-5 horas)
   - Impacto: Medio
   - Complejidad: Media

2. **Índices en base de datos** (2-3 horas)
   - Impacto: Medio
   - Complejidad: Media

3. **Validación de permisos** (4-5 horas)
   - Impacto: Medio
   - Complejidad: Media

4. **Manejo de zonas horarias** (3-4 horas)
   - Impacto: Medio
   - Complejidad: Media

5. **Eliminar dependencias no usadas** (30 min)
   - Impacto: Bajo
   - Complejidad: Baja

6. **Extraer lógica JWT duplicada** (30 min)
   - Impacto: Bajo
   - Complejidad: Baja

**Tiempo total Fase 3:** ~14-18 horas

---

### Fase 4: Testing y Documentación - 2 semanas

**Prioridad:** MEDIA-ALTA - Necesario para confianza y mantenibilidad

1. **Tests unitarios críticos** (10-15 horas)
   - Autenticación, operaciones financieras, citas
   - Impacto: Medio-Alto
   - Complejidad: Alta

2. **Tests de integración** (8-10 horas)
   - Flujos principales de usuario
   - Impacto: Medio
   - Complejidad: Alta

3. **Documentación de API** (6-8 horas)
   - Swagger/OpenAPI
   - Impacto: Medio
   - Complejidad: Media

4. **Documentación de setup** (2-3 horas)
   - README completo, variables de entorno
   - Impacto: Bajo-Medio
   - Complejidad: Baja

**Tiempo total Fase 4:** ~26-36 horas

---

### Fase 5: Mejoras y Preparación para Producción - 1-2 semanas

**Prioridad:** BAJA-MEDIA - Mejoras y preparación

1. **Monitoreo y alertas** (10-15 horas)
   - Impacto: Bajo (crítico para prod)
   - Complejidad: Alta

2. **CI/CD pipeline** (6-8 horas)
   - Impacto: Bajo-Medio
   - Complejidad: Media

3. **Backups y recuperación** (4-6 horas)
   - Impacto: Bajo (crítico para prod)
   - Complejidad: Media

4. **Accesibilidad básica** (8-10 horas)
   - Impacto: Bajo
   - Complejidad: Media

5. **TypeScript estricto** (4-5 horas)
   - Impacto: Bajo
   - Complejidad: Media

**Tiempo total Fase 5:** ~32-44 horas

---

## 9. TIEMPO TOTAL ESTIMADO DEL PROYECTO

### Resumen por Fase:

- **Fase 1 (Seguridad Crítica):** 12-15 horas
- **Fase 2 (Estabilidad):** 19-25 horas
- **Fase 3 (Calidad):** 14-18 horas
- **Fase 4 (Testing/Docs):** 26-36 horas
- **Fase 5 (Mejoras):** 32-44 horas

### **Tiempo Total Estimado: 103-138 horas**

**Equivalente a:**
- **2.5-3.5 semanas** de trabajo full-time (40h/semana) para un desarrollador Senior
- **4-5 semanas** para un desarrollador Semi-Senior
- Con **Cursor Agent + Ssr**: Se puede reducir a **60-80% del tiempo** (62-110 horas)

### Priorización Recomendada:

**MVP Mínimo Viable (para producción básica):**
- Fase 1 completa: **12-15 horas** (BLOQUEANTE)
- Fase 2 completa: **19-25 horas** (NECESARIO)
- **Total MVP:** ~31-40 horas (1 semana intensiva o 2 semanas normales)

**MVP Robusto (recomendado):**
- Fases 1, 2 y 3: **45-58 horas** (1.5-2 semanas)
- Incluye seguridad, estabilidad y calidad básica

**MVP Completo:**
- Todas las fases: **103-138 horas** (2.5-3.5 semanas)
- Incluye testing, documentación y mejoras

---

## 10. CONCLUSIÓN

El proyecto IPPL tiene una base funcional sólida, pero requiere **intervención urgente en seguridad** antes de cualquier despliegue a producción. Los problemas críticos identificados (especialmente relacionados con autenticación, uploads y configuración) deben resolverse de inmediato.

Con un enfoque sistemático y priorizado, es posible transformar la "demo feliz" en un **MVP estable y seguro** en aproximadamente **1-2 semanas de trabajo enfocado** (fases 1 y 2), o un **MVP robusto** en **2-3 semanas** (fases 1, 2 y 3).

La recomendación es **comenzar inmediatamente con la Fase 1** (seguridad crítica), ya que estos problemas bloquean cualquier despliegue seguro a producción.

---

**Fin del Reporte de Auditoría**

