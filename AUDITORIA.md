# Informe de Auditoría Técnica
**Proyecto:** vite-react-typescript-starter (IPPL)
**Fecha:** 2025-10-30
**Auditor:** IA - Cursor Audit

---

## 📛 Críticos
Problemas que pueden romper la aplicación, exponer datos o comprometer el funcionamiento.

1) Hardcode de secreto JWT (riesgo de compromiso de autenticación)
- **Archivo:** `backend/src/middleware/auth.js`
- **Descripción:** Se define un secreto JWT por defecto en código.
```1:6:backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tu_secreto_super_seguro';
```
- **Impacto:** Un atacante que obtenga el repo o accesso al entorno sin `JWT_SECRET` quedará con un secreto predecible. Facilita forja de tokens.
- **Sugerencia de solución:** Obligar `JWT_SECRET` por entorno (fallar si no está) y rotarlo. Nunca usar fallback en código.

2) Hardcode de credenciales/parametría de base de datos
- **Archivo:** `backend/config/config.js`
- **Descripción:** Valores por defecto (usuario, contraseña, DB) se incluyen en código.
```4:12:backend/config/config.js
module.exports = {
    development: {
        username: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || 'root1234',
        database: process.env.DB_NAME || 'ippl_db',
```
- **Impacto:** Filtración de credenciales, uso accidental en producción, facilita intrusiones.
- **Sugerencia de solución:** Eliminar defaults sensibles; exigir variables de entorno seguras y usar secretos del entorno/secret manager.

3) Diseño de refresh sin refresh token dedicado
- **Archivo:** `backend/src/controllers/authController.js`
- **Descripción:** `refreshToken` acepta tokens expirados (`ignoreExpiration: true`) y emite nuevos sin un refresh token independiente.
```58:76:backend/src/controllers/authController.js
const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
// ...
const newToken = generateToken(user);
```
- **Impacto:** Si un token es robado, puede usarse indefinidamente para obtener tokens nuevos mientras no cambie el secreto ni el usuario. No hay rotación/blacklist.
- **Sugerencia de solución:** Implementar refresh tokens de larga vida almacenados de forma segura (DB/Redis) con rotación (rotate on use), revocación y parejas access+refresh.

4) Subida y exposición pública de archivos sin validación estricta
- **Archivo:** `backend/src/index.js`
- **Descripción:** Se permite subir archivos arbitrarios y se exponen estáticamente sin validación de tipo/magic number ni sanitización de nombre.
```88:117:backend/src/index.js
app.post('/api/upload', upload.single('file'), (req, res) => {
  // ... guarda cualquier archivo y lo sirve en /uploads
});
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
```
- **Impacto:** Riesgo de almacenamiento de malware, XSS almacenado (por SVG/HTML), y exposición de datos si se suben documentos sensibles.
- **Sugerencia de solución:** Restringir tipos por `fileFilter` y validar magic numbers, renombrar/normalizar extensiones, almacenar fuera de la carpeta servida públicamente y servir con URLs firmadas o tras verificación; deshabilitar servir SVG/HTML.

5) CORS permisivo por defecto (endurecimiento faltante)
- **Archivo:** `backend/src/index.js`
- **Descripción:** `app.use(cors());` permite orígenes amplios sin restricción.
- **Impacto:** Aumenta superficie de ataque para CSRF/abuso desde orígenes no confiables.
- **Sugerencia de solución:** Configurar `cors` con lista blanca de `origin`, métodos y headers esperados.

6) Token en localStorage (riesgo ante XSS)
- **Archivo:** `src/config/api.ts`, `src/services/api.ts`, contextos de auth
- **Descripción:** Se almacena el token en `localStorage` y se inserta en `Authorization` desde el cliente.
- **Impacto:** Si hay XSS, el token puede ser exfiltrado. Persistencia define mayor ventana de exposición.
- **Sugerencia de solución:** Usar cookies HttpOnly + SameSite para tokens de sesión o evaluar almacenamiento en memoria con protección adicional y CSP fuerte.

7) Inconsistencia de endpoints de autenticación (potencial fallo de protección)
- **Archivo:** `src/contexts/AuthContext.tsx` y backend rutas
- **Descripción:** El frontend invoca `/auth/me`, pero el backend sólo expone `/auth/login` y `/auth/refresh-token`.
```28:35:src/contexts/AuthContext.tsx
const response = await api.get('/auth/me');
```
- **Impacto:** Errores sistemáticos de autenticación/estado de sesión; protección de rutas puede fallar.
- **Sugerencia de solución:** Implementar `/api/auth/me` en backend o unificar el uso a endpoints existentes; alinear ambos contextos.

---

## ❌ Errores
Errores de compilación, linter, tipado o ejecución.

1) Operador `+` accidental antes de `console.log`
- **Archivo:** `backend/src/index.js`
- **Descripción:** `+console.log('✅ [DB] Conectada correctamente');`
```139:147:backend/src/index.js
await sequelize.authenticate();
+console.log('✅ [DB] Conectada correctamente');
```
- **Causa probable:** Typo; el operador unario evita la ejecución del `console.log` (coerción a número) y no registra el mensaje.
- **Recomendación:** Eliminar el `+`.

2) `index.html` referencia de favicon incorrecta con Vite
- **Archivo:** `index.html`
- **Descripción:** Usa `/public/favicon.png` en lugar de `/favicon.png`.
```3:8:index.html
<link rel="icon" href="/public/favicon.png" />
```
- **Causa probable:** Confusión con carpeta `public` de Vite.
- **Recomendación:** Cambiar a `/favicon.png`.

3) Duplicidad de clientes HTTP con configuraciones divergentes
- **Archivo:** `src/config/api.ts` y `src/services/api.ts`
- **Descripción:** Dos instancias de Axios: una usa `VITE_API_URL`, la otra hardcodea `http://localhost:5000/api`.
```1:7:src/services/api.ts
const BASE_URL = 'http://localhost:5000/api';
```
- **Causa probable:** Migración/duplicación no consolidada.
- **Recomendación:** Unificar en un único cliente (`src/config/api.ts`) y eliminar el duplicado.

4) Doble implementación de contexto de autenticación
- **Archivo:** `src/context/AuthContext.tsx` y `src/contexts/AuthContext.tsx`
- **Descripción:** Dos contextos con APIs distintas (una usa `authService`, otra `api`).
- **Causa probable:** Refactor parcial.
- **Recomendación:** Consolidar en un solo `AuthContext` tipado, alineado con endpoints reales.

---

## ⚠️ Advertencias
Implementaciones que funcionan pero con riesgo o mala práctica.

1) Falta de filtrado de tipo MIME en uploads
- **Archivo:** `backend/src/index.js`
- **Descripción:** No hay `fileFilter` en `multer` para limitar tipos permitidos.
- **Motivo de advertencia:** Riesgo de subir contenido no permitido.
- **Sugerencia:** Implementar `fileFilter` y validación por magic number.

2) Falta de `helmet`, rate limiting y logs estructurados
- **Archivo:** `backend/src/index.js`
- **Descripción:** No se aplican middlewares de endurecimiento ni límites de peticiones.
- **Motivo de advertencia:** Seguridad y resiliencia.
- **Sugerencia:** Agregar `helmet`, `express-rate-limit`, `morgan`/logs estructurados.

3) Dependencias posiblemente no utilizadas (código muerto)
- **Archivo:** `backend/package.json`
- **Descripción:** `mongoose` está declarado pero backend usa Sequelize; también `pg`/`pg-hstore` aunque la configuración apunta a MySQL.
- **Motivo de advertencia:** Aumenta superficie de ataque y tamaño.
- **Sugerencia:** Auditar uso real y eliminar dependencias innecesarias.

4) Consolas en producción y trazas ruidosas
- **Archivo:** `src/context/AuthContext.tsx`
- **Descripción:** `console.debug` en montaje.
- **Motivo de advertencia:** Ruido/logs sensibles en clientes.
- **Sugerencia:** Guardas por `NODE_ENV` o logger controlado.

5) Duplicación de lógica JWT en cliente
- **Archivo:** `src/config/api.ts` y `src/services/api.ts`
- **Descripción:** Funciones `decodeJwtPayload`/`isTokenExpired` duplicadas.
- **Motivo de advertencia:** Mantenimiento difícil, bugs inconsistentes.
- **Sugerencia:** Extraer a util único y reutilizar.

---

## 💭 Pasable o Sugerible
Mejoras no urgentes pero deseables.

1) Accesibilidad básica en `index.html` y componentes
- **Archivo:** `index.html` y `src/components/*`
- **Descripción:** Revisar `aria-*`, roles, foco en modales y textos alternativos en imágenes.
- **Sugerencia:** Añadir pruebas de accesibilidad (axe), roles y manejo de foco en modales.

2) Configurar CSP para mitigar XSS
- **Archivo:** Backend headers
- **Descripción:** No se observan cabeceras CSP.
- **Sugerencia:** Establecer `Content-Security-Policy` adecuada a recursos usados.

3) Separar servicio de archivos de la app principal
- **Archivo:** `backend/src/index.js`
- **Descripción:** La app sirve archivos estáticos y API en el mismo proceso.
- **Sugerencia:** Considerar CDN o servicio de objetos (S3/GCS) con URLs firmadas.

4) Tests de integración para rutas protegidas
- **Archivo:** `src/pages/__tests__` limitado
- **Descripción:** Pocos tests.
- **Sugerencia:** Añadir tests de e2e/integración para auth, roles y uploads.

5) Tipado estricto y ESLint más restrictivo
- **Archivo:** `eslint.config.js`
- **Descripción:** Reglas base.
- **Sugerencia:** Activar reglas de seguridad y `typescript-eslint` más estrictas; prohibir `any` implícito.

---

## ✅ Sin problemas
Módulos o secciones sin observaciones relevantes.

- **Archivo:** `vite.config.ts`
- **Motivo de conformidad:** Configuración estándar con proxy a backend local.

- **Archivo:** `vitest.config.ts`
- **Motivo de conformidad:** Setup de pruebas razonable con cobertura configurada.

- **Archivo:** `eslint.config.js`
- **Motivo de conformidad:** Base adecuada para React/TS y hooks.

---

## 🧩 Resumen General
- Críticos: 7  
- Errores: 4  
- Advertencias: 5  
- Sugeribles: 5  
- Sin problemas: 3  

Conclusión: El proyecto es funcional, pero presenta vulnerabilidades graves en autenticación (secreto JWT hardcodeado, refresh sin tokens dedicados), manejo de archivos (uploads sin validación y exposición pública) y configuraciones inseguras por defecto (DB/CORS). Además, hay duplicidad de clientes HTTP y contextos de autenticación que incrementan la complejidad y el riesgo de inconsistencias. Se recomienda abordar los críticos de seguridad de inmediato, unificar la capa de cliente/auth, y endurecer el backend (helmet, CORS estricto, rate limit) antes del próximo release.

---

## Anexos (Referencias de código)

1) JWT Secret en middleware
```1:6:backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tu_secreto_super_seguro';
```

2) Refresh token sin refresh dedicado
```58:76:backend/src/controllers/authController.js
const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
// ...
const newToken = generateToken(user);
```

3) Uploads y exposición pública
```116:128:backend/src/index.js
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
const FRONTEND_DIST = path.resolve(__dirname, '../../dist');
```

4) Typo `+console.log`
```142:147:backend/src/index.js
await sequelize.authenticate();
+console.log('✅ [DB] Conectada correctamente');
```

5) BASE_URL hardcodeado
```1:7:src/services/api.ts
const BASE_URL = 'http://localhost:5000/api';
```

6) Endpoint inexistente `/auth/me` en frontend
```28:35:src/contexts/AuthContext.tsx
const response = await api.get('/auth/me');
```



