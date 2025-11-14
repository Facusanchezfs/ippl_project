# 🔍 Evaluación de Preparación para Iniciar Trabajos Críticos (MVP)

**Proyecto:** IPPL (Instituto de Psicología)  
**Fecha:** 2025-01-27  
**Evaluador:** Cursor AI Agent  
**Fuente:** AUDITORIA_COMPLETA.md

---

## EVALUACIÓN DE PREPARACIÓN – PROBLEMAS CRÍTICOS

---

### 🔴 CRÍTICO #1: Secreto JWT hardcodeado con fallback inseguro

**Nivel de preparación:** 95%

**Semáforo:** 🟢 **Puede iniciarse ya mismo**

**Qué podría romperse:**
- **Riesgo:** Bajo
- Si el servidor no tiene `JWT_SECRET` configurado y se elimina el fallback, el servidor no iniciará
- **Mitigación:** Validar al inicio y fallar con mensaje claro si falta la variable
- No rompe funcionalidad existente, solo previene inicio inseguro

**Prerequisitos:**
- Ninguno. El código está visible y accesible
- Solo requiere modificar 2 archivos: `backend/src/middleware/auth.js` y `backend/src/controllers/authController.js`
- No depende de otros cambios

**Dependencias técnicas:**
- **Independiente:** No depende de ningún otro crítico
- **Base para otros:** Este debe corregirse ANTES de trabajar en refresh tokens (#2) y migración a cookies (#5)
- Si se corrige primero, facilita el trabajo en autenticación

**Complejidad de iniciar:**
- **Preparación:** 0 horas (listo para empezar)
- El código está claro, los archivos son accesibles, no hay dependencias externas
- Solo requiere: eliminar fallback, agregar validación, documentar variable

**Conclusión:** 
Problema completamente aislado y listo para corregir inmediatamente. Es la base para otros trabajos de autenticación. **PRIORIDAD MÁXIMA para iniciar primero.**

---

### 🔴 CRÍTICO #2: Sistema de refresh token sin tokens dedicados ni revocación

**Nivel de preparación:** 60%

**Semáforo:** 🟡 **Puede iniciarse con preparación previa**

**Qué podría romperse:**
- **Riesgo:** Medio-Alto
- Cambiar el sistema de refresh token afectará a todos los clientes que usan `/auth/refresh-token`
- El frontend actualmente no maneja refresh tokens separados, solo renueva el access token
- Si se implementa mal, puede dejar usuarios sin sesión
- **Mitigación:** Implementar de forma backward-compatible inicialmente o coordinar cambio frontend/backend

**Prerequisitos:**
1. **CRÍTICO #1 debe estar resuelto** (JWT_SECRET sin fallback) - 30 min
2. **CRÍTICO #6 debe estar resuelto** (endpoint `/auth/me` implementado) - 1 hora
   - Necesario para que el frontend pueda verificar sesión correctamente
3. Crear migración para tabla `RefreshTokens` - 15 min
4. Decidir estrategia: ¿backward-compatible o breaking change? - 30 min

**Dependencias técnicas:**
- **Depende de:** #1 (JWT_SECRET), #6 (`/auth/me`)
- **Bloquea a:** #5 (migración a cookies, necesita refresh tokens funcionando)
- **Relacionado con:** #8 (unificar contextos de auth facilita implementación)

**Complejidad de iniciar:**
- **Preparación necesaria:** 2-3 horas
  1. Resolver #1 (30 min)
  2. Resolver #6 (1 hora)
  3. Crear modelo RefreshToken (30 min)
  4. Planificar estrategia de migración (30 min)
  5. Auditar uso actual de refresh token en frontend (30 min)

**Conclusión:** 
Requiere preparación previa pero es factible. Debe hacerse después de #1 y #6. El cambio es significativo pero el código actual es simple, lo que facilita la refactorización.

---

### 🔴 CRÍTICO #3: Uploads de archivos sin validación de tipo ni sanitización

**Nivel de preparación:** 70%

**Semáforo:** 🟡 **Puede iniciarse con preparación previa**

**Qué podría romperse:**
- **Riesgo:** Medio
- Si se agrega validación estricta, archivos que antes se aceptaban pueden rechazarse
- Componentes del frontend que suben archivos pueden fallar si cambia el formato de respuesta
- **Mitigación:** Implementar validación gradual, mantener compatibilidad temporal, documentar tipos permitidos

**Prerequisitos:**
1. Auditar qué tipos de archivos se suben actualmente - 1 hora
   - Revisar todos los endpoints de upload
   - Identificar casos de uso (imágenes, PDFs, audios)
2. Decidir política de tipos permitidos - 30 min
3. Instalar dependencias necesarias (`file-type`, `uuid`) - 15 min
4. Verificar qué componentes del frontend usan uploads - 30 min

**Dependencias técnicas:**
- **Independiente:** No depende de otros críticos
- **Relacionado con:** #12 (Helmet/CSP ayuda con seguridad de uploads)
- Puede hacerse en paralelo con otros críticos

**Complejidad de iniciar:**
- **Preparación necesaria:** 2-2.5 horas
  1. Auditoría de uploads actuales (1 hora)
  2. Definir política de tipos (30 min)
  3. Instalar dependencias (15 min)
  4. Revisar frontend (30 min)
  5. Planificar migración de archivos existentes si es necesario (15 min)

**Conclusión:** 
Listo para iniciar después de auditoría rápida. El código de multer es accesible y modificable. Requiere coordinación con frontend pero no bloquea otros trabajos.

---

### 🔴 CRÍTICO #4: CORS permisivo sin restricciones

**Nivel de preparación:** 90%

**Semáforo:** 🟢 **Puede iniciarse ya mismo**

**Qué podría romperse:**
- **Riesgo:** Bajo-Medio
- Si se restringe CORS demasiado, el frontend puede dejar de funcionar
- Requests desde localhost en desarrollo pueden fallar si no se configura bien
- **Mitigación:** Configurar lista blanca que incluya localhost y dominio de producción, testear inmediatamente

**Prerequisitos:**
1. Identificar todos los orígenes que deben tener acceso - 15 min
   - Frontend local (desarrollo): `http://localhost:5173`
   - Frontend producción: definir dominio
2. Verificar si hay otros clientes (mobile, etc.) - 15 min
3. Agregar variable `ALLOWED_ORIGINS` al `.env.example` - 5 min

**Dependencias técnicas:**
- **Independiente:** No depende de otros críticos
- Puede hacerse en paralelo con cualquier otro trabajo
- No bloquea ni es bloqueado por otros críticos

**Complejidad de iniciar:**
- **Preparación necesaria:** 30-45 minutos
  1. Identificar orígenes permitidos (15 min)
  2. Verificar clientes adicionales (15 min)
  3. Documentar variable de entorno (5 min)

**Conclusión:** 
Casi listo para iniciar. Solo requiere identificar orígenes permitidos. Cambio simple y de bajo riesgo si se configura correctamente. **Puede hacerse en paralelo con otros críticos.**

---

### 🔴 CRÍTICO #5: Token almacenado en localStorage (vulnerable a XSS)

**Nivel de preparación:** 40%

**Semáforo:** 🔴 **No puede iniciarse aún (bloqueado por dependencias)**

**Qué podría romperse:**
- **Riesgo:** Alto
- Cambiar de localStorage a cookies afecta TODA la autenticación del frontend
- Todos los componentes que leen el token fallarán
- Interceptors de Axios deben modificarse
- **Mitigación:** Requiere cambio coordinado frontend/backend, testing exhaustivo

**Prerequisitos:**
1. **CRÍTICO #1 resuelto** (JWT_SECRET) - 30 min
2. **CRÍTICO #2 resuelto o al menos planificado** (refresh tokens) - 4-6 horas
3. **CRÍTICO #6 resuelto** (`/auth/me` endpoint) - 1 hora
4. **CRÍTICO #8 resuelto** (unificar contextos de auth) - 2-3 horas
   - **CRÍTICO:** No se puede migrar a cookies si hay dos contextos diferentes
5. Auditar TODOS los lugares donde se usa `localStorage.getItem('token')` - 1 hora
6. Decidir estrategia: cookies HttpOnly vs memoria - 30 min
7. Configurar `cookie-parser` en backend - 15 min

**Dependencias técnicas:**
- **Depende críticamente de:** #1, #2, #6, #8
- **Bloquea a:** Ninguno directamente, pero es parte del sistema de auth
- **Relacionado con:** Todo el sistema de autenticación

**Complejidad de iniciar:**
- **Preparación necesaria:** 8-12 horas
  1. Resolver dependencias (#1, #2, #6, #8) - 7-10 horas
  2. Auditoría completa de uso de token - 1 hora
  3. Planificar estrategia de migración - 1 hora
  4. Setup de cookies en backend - 15 min

**Conclusión:** 
**BLOQUEADO** hasta resolver #1, #2, #6 y #8. Es el cambio más complejo del sistema de autenticación y requiere que todo lo demás esté estable. **NO iniciar hasta tener base sólida.**

---

### 🔴 CRÍTICO #6: Endpoint `/auth/me` inexistente en backend

**Nivel de preparación:** 85%

**Semáforo:** 🟢 **Puede iniciarse ya mismo**

**Qué podría romperse:**
- **Riesgo:** Bajo
- El frontend ya intenta llamar a este endpoint y falla silenciosamente
- Implementarlo solo arreglará el comportamiento actual
- **Mitigación:** El endpoint es simple, solo valida token y devuelve usuario

**Prerequisitos:**
1. **CRÍTICO #1 debe estar resuelto o al menos planificado** (JWT_SECRET)
   - No es bloqueante, pero es mejor tenerlo resuelto
2. Verificar qué formato de respuesta espera el frontend - 15 min
   - Revisar `src/contexts/AuthContext.tsx:32` para ver qué espera

**Dependencias técnicas:**
- **Depende ligeramente de:** #1 (JWT_SECRET, pero puede hacerse con fallback temporal)
- **Bloquea a:** #2 (refresh tokens necesita verificación de usuario), #5 (cookies necesita endpoint de verificación), #8 (unificar contextos)
- **Facilita:** Todos los trabajos de autenticación

**Complejidad de iniciar:**
- **Preparación necesaria:** 15-30 minutos
  1. Revisar qué espera el frontend (15 min)
  2. Verificar formato de UserDTO (15 min)

**Conclusión:** 
Casi listo para iniciar. Endpoint simple que solo requiere leer código existente. **PRIORIDAD ALTA** porque desbloquea otros trabajos (#2, #5, #8). Puede hacerse en paralelo con #1.

---

### 🔴 CRÍTICO #7: Credenciales de base de datos hardcodeadas

**Nivel de preparación:** 95%

**Semáforo:** 🟢 **Puede iniciarse ya mismo**

**Qué podría romperse:**
- **Riesgo:** Bajo (si se hace bien)
- Si se eliminan fallbacks sin configurar variables, el servidor no iniciará
- En desarrollo, puede romper setup de nuevos desarrolladores si no documentan bien
- **Mitigación:** Validar al inicio con mensajes claros, crear `.env.example` completo

**Prerequisitos:**
1. Crear/actualizar `.env.example` con todas las variables - 15 min
2. Documentar en README las variables requeridas - 15 min
3. Verificar que existe `.env` en desarrollo (o documentar creación) - 10 min

**Dependencias técnicas:**
- **Independiente:** No depende de otros críticos
- Puede hacerse en paralelo con cualquier otro trabajo
- No bloquea ni es bloqueado

**Complejidad de iniciar:**
- **Preparación necesaria:** 30-40 minutos
  1. Crear `.env.example` completo (15 min)
  2. Documentar variables en README (15 min)
  3. Verificar setup actual (10 min)

**Conclusión:** 
Listo para iniciar. Cambio simple y aislado. **Puede hacerse en paralelo con otros críticos.** Solo requiere documentación adecuada.

---

### 🔴 CRÍTICO #8: Duplicidad de clientes HTTP y contextos de autenticación

**Nivel de preparación:** 50%

**Semáforo:** 🟡 **Puede iniciarse con preparación previa**

**Qué podría romperse:**
- **Riesgo:** Medio-Alto
- Eliminar `src/services/api.ts` puede romper componentes que lo importan
- Unificar contextos puede cambiar la API de `useAuth()`, rompiendo componentes
- **Mitigación:** Auditar todos los imports primero, hacer migración gradual

**Prerequisitos:**
1. **CRÍTICO #6 debe estar resuelto** (`/auth/me` endpoint) - 1 hora
   - Necesario para que el contexto unificado funcione
2. Auditar TODOS los imports de `api` y `AuthContext` - 2 horas
   - Buscar `from '../services/api'`
   - Buscar `from '../config/api'`
   - Buscar `from '../contexts/AuthContext'`
   - Buscar `from '../context/AuthContext'`
3. Identificar qué contexto usa `App.tsx` actualmente - 15 min
4. Decidir qué contexto mantener (probablemente `context/AuthContext.tsx` que usa `authService`) - 30 min

**Dependencias técnicas:**
- **Depende de:** #6 (`/auth/me` para contexto unificado)
- **Bloquea a:** #5 (migración a cookies necesita contexto único)
- **Facilita:** Todos los trabajos de autenticación

**Complejidad de iniciar:**
- **Preparación necesaria:** 3.5-4 horas
  1. Resolver #6 (1 hora)
  2. Auditoría completa de imports (2 horas)
  3. Verificar App.tsx (15 min)
  4. Planificar migración (30 min)
  5. Decidir qué mantener (30 min)

**Conclusión:** 
Requiere auditoría exhaustiva antes de tocar. El riesgo de romper es medio-alto si no se audita bien. **Hacer después de #6, antes de #5.**

---

### 🔴 CRÍTICO #9: Falta de transacciones en operaciones críticas

**Nivel de preparación:** 45%

**Semáforo:** 🟡 **Puede iniciarse con preparación previa**

**Qué podría romperse:**
- **Riesgo:** Medio
- Agregar transacciones puede cambiar el comportamiento en caso de errores (rollback vs partial save)
- Si hay lógica que depende de saves parciales, puede romperse
- **Mitigación:** Auditar operaciones críticas primero, testear rollback

**Prerequisitos:**
1. Auditar TODOS los controladores que hacen múltiples writes - 3-4 horas
   - Identificar operaciones que tocan múltiples tablas
   - Identificar operaciones financieras
   - Identificar operaciones con relaciones
2. Revisar qué operaciones YA usan transacciones (ej: `updateAppointment`, `abonarComision`) - 1 hora
   - Para entender el patrón existente
3. Identificar operaciones que NO deberían usar transacciones - 30 min
   - Algunas operaciones pueden ser intencionalmente no-transaccionales

**Dependencias técnicas:**
- **Independiente:** No depende de otros críticos
- Puede hacerse en paralelo con otros trabajos
- **Relacionado con:** #10 (validación, ambos mejoran integridad)

**Complejidad de iniciar:**
- **Preparación necesaria:** 4.5-5.5 horas
  1. Auditoría completa de controladores (3-4 horas)
  2. Revisar patrones existentes (1 hora)
  3. Identificar exclusiones (30 min)

**Conclusión:** 
Requiere auditoría exhaustiva antes de tocar código. El trabajo es grande pero puede hacerse en paralelo con otros críticos. **Prioridad media, puede esperar.**

---

### 🔴 CRÍTICO #10: Falta de validación de entrada en múltiples endpoints

**Nivel de preparación:** 55%

**Semáforo:** 🟡 **Puede iniciarse con preparación previa**

**Qué podría romperse:**
- **Riesgo:** Medio
- Agregar validación estricta puede rechazar datos que antes se aceptaban
- Frontend puede enviar datos en formato que ahora se rechaza
- **Mitigación:** Validación gradual, mantener compatibilidad temporal, documentar cambios

**Prerequisitos:**
1. Decidir librería de validación (`express-validator`, `Joi`, `Zod`) - 30 min
2. Auditar endpoints principales para entender qué validan actualmente - 2 horas
   - `createUser`, `createAppointment`, `updateUser`, etc.
3. Identificar qué formatos de datos acepta el frontend - 1 hora
4. Crear estructura de schemas de validación - 30 min

**Dependencias técnicas:**
- **Independiente:** No depende de otros críticos
- Puede hacerse en paralelo
- **Relacionado con:** #9 (transacciones, ambos mejoran integridad)

**Complejidad de iniciar:**
- **Preparación necesaria:** 4 horas
  1. Decidir librería (30 min)
  2. Auditoría de endpoints (2 horas)
  3. Revisar frontend (1 hora)
  4. Estructura de schemas (30 min)

**Conclusión:** 
Requiere planificación y auditoría. Trabajo grande pero factible. Puede hacerse en paralelo con otros críticos. **Prioridad media.**

---

### 🔴 CRÍTICO #11: Falta de rate limiting

**Nivel de preparación:** 90%

**Semáforo:** 🟢 **Puede iniciarse ya mismo**

**Qué podría romperse:**
- **Riesgo:** Bajo
- Si se configura muy restrictivo, usuarios legítimos pueden ser bloqueados
- **Mitigación:** Configurar límites razonables, testear con uso normal, ajustar según necesidad

**Prerequisitos:**
1. Decidir límites por endpoint - 30 min
   - Global: 100 req/min
   - Login: 5 intentos/15 min
   - Escritura: 20 req/min
2. Verificar si hay uso de proxy/load balancer (afecta detección de IP) - 15 min

**Dependencias técnicas:**
- **Independiente:** No depende de otros críticos
- Puede hacerse en paralelo con cualquier trabajo
- No bloquea ni es bloqueado

**Complejidad de iniciar:**
- **Preparación necesaria:** 45 minutos
  1. Decidir límites (30 min)
  2. Verificar infraestructura (15 min)

**Conclusión:** 
Casi listo para iniciar. Solo requiere decidir límites. Cambio simple y de bajo riesgo. **Puede hacerse en paralelo con otros críticos.**

---

### 🔴 CRÍTICO #12: Falta de headers de seguridad (Helmet)

**Nivel de preparación:** 95%

**Semáforo:** 🟢 **Puede iniciarse ya mismo**

**Qué podría romperse:**
- **Riesgo:** Bajo
- CSP muy restrictiva puede bloquear recursos legítimos (scripts, estilos, imágenes)
- **Mitivación:** Configurar CSP gradualmente, testear que todo funciona, ajustar según recursos usados

**Prerequisitos:**
1. Identificar recursos externos usados (CDNs, fonts, etc.) - 30 min
2. Decidir configuración de CSP según recursos - 30 min

**Dependencias técnicas:**
- **Independiente:** No depende de otros críticos
- Puede hacerse en paralelo
- **Relacionado con:** #3 (uploads, CSP ayuda con seguridad de archivos)

**Complejidad de iniciar:**
- **Preparación necesaria:** 1 hora
  1. Identificar recursos externos (30 min)
  2. Planificar CSP (30 min)

**Conclusión:** 
Listo para iniciar. Cambio simple. Solo requiere identificar recursos para configurar CSP correctamente. **Puede hacerse en paralelo.**

---

### 🔴 CRÍTICO #13: Logs de consola en producción

**Nivel de preparación:** 70%

**Semáforo:** 🟡 **Puede iniciarse con preparación previa**

**Qué podría romperse:**
- **Riesgo:** Bajo-Medio
- Si se reemplazan `console.log` incorrectamente, se pueden perder logs importantes
- Cambiar formato de logs puede romper herramientas de análisis existentes
- **Mitigación:** Implementar logger que también escriba a console en desarrollo, mantener formato compatible

**Prerequisitos:**
1. Decidir librería de logging (`winston`, `pino`) - 30 min
2. Auditar qué información sensible se loguea actualmente - 1 hora
   - Passwords, tokens, datos personales
3. Planificar niveles de log y estructura - 30 min
4. Verificar si hay herramientas de análisis de logs en producción - 15 min

**Dependencias técnicas:**
- **Independiente:** No depende de otros críticos
- Puede hacerse en paralelo
- **Relacionado con:** #15 (error de sintaxis en console.log)

**Complejidad de iniciar:**
- **Preparación necesaria:** 2-2.5 horas
  1. Decidir librería (30 min)
  2. Auditoría de logs sensibles (1 hora)
  3. Planificar estructura (30 min)
  4. Verificar herramientas (15 min)

**Conclusión:** 
Requiere planificación pero es factible. Puede hacerse en paralelo con otros trabajos. **Prioridad media-baja** (no bloquea MVP pero es importante para producción).

---

### 🔴 CRÍTICO #14: Dependencias no utilizadas y conflictos

**Nivel de preparación:** 80%

**Semáforo:** 🟢 **Puede iniciarse ya mismo**

**Qué podría romperse:**
- **Riesgo:** Bajo
- Si se elimina una dependencia que SÍ se usa (aunque no sea obvio), el código puede romperse
- **Mitigación:** Buscar exhaustivamente imports antes de eliminar, testear después de eliminar

**Prerequisitos:**
1. Buscar imports de `mongoose`, `pg`, `pg-hstore` en TODO el código - 30 min
   - Backend y frontend
   - Incluir búsqueda case-insensitive
2. Verificar si hay uso indirecto (plugins, etc.) - 15 min
3. Ejecutar tests después de eliminar (si existen) - 15 min

**Dependencias técnicas:**
- **Independiente:** No depende de otros críticos
- Puede hacerse en paralelo
- No bloquea ni es bloqueado

**Complejidad de iniciar:**
- **Preparación necesaria:** 1 hora
  1. Búsqueda exhaustiva de imports (30 min)
  2. Verificar uso indirecto (15 min)
  3. Planificar testing (15 min)

**Conclusión:** 
Listo para iniciar después de búsqueda rápida. Cambio simple y de bajo riesgo si se verifica bien. **Puede hacerse en paralelo.**

---

### 🔴 CRÍTICO #15: Error de sintaxis: operador `+` antes de console.log

**Nivel de preparación:** 100%

**Semáforo:** 🟢 **Puede iniciarse ya mismo**

**Qué podría romperse:**
- **Riesgo:** Muy Bajo
- Solo corrige un error, no rompe nada
- **Nota:** Al revisar el código actual, no se observa el `+console.log`, puede que ya esté corregido

**Prerequisitos:**
1. Verificar si el error existe realmente - 5 min
   - Buscar `+console.log` en el código
2. Si existe, eliminarlo - 1 min

**Dependencias técnicas:**
- **Independiente:** No depende de otros críticos
- Puede hacerse en cualquier momento

**Complejidad de iniciar:**
- **Preparación necesaria:** 5 minutos
  1. Verificar existencia (5 min)

**Conclusión:** 
Si existe el error, es trivial de corregir. **Puede hacerse inmediatamente en cualquier momento.**

---

## ORDEN PROPUESTO PARA INICIAR TRABAJOS

### Fase 1: Inmediatos (🟢 Listos para empezar YA) - 4-5 horas

1. **CRÍTICO #15** - Error de sintaxis (5 min) - Verificar y corregir
2. **CRÍTICO #1** - JWT_SECRET sin fallback (30 min) - Base para auth
3. **CRÍTICO #6** - Endpoint `/auth/me` (1 hora) - Desbloquea otros trabajos
4. **CRÍTICO #4** - CORS restrictivo (30 min) - Seguridad básica
5. **CRÍTICO #7** - Credenciales DB sin fallback (1 hora) - Seguridad básica
6. **CRÍTICO #11** - Rate limiting (1-2 horas) - Seguridad básica
7. **CRÍTICO #12** - Headers de seguridad Helmet (30 min) - Seguridad básica
8. **CRÍTICO #14** - Dependencias no usadas (1 hora) - Limpieza

**Total Fase 1:** ~6-8 horas de trabajo real

---

### Fase 2: Con preparación previa (🟡 Requieren auditoría) - 8-12 horas

9. **CRÍTICO #8** - Unificar clientes HTTP y contextos (2-3 horas + 3.5-4h prep)
   - **Depende de:** #6 (ya resuelto en Fase 1)
   - **Preparación:** Auditoría de imports (2h) + planificación (1.5h)

10. **CRÍTICO #2** - Refresh tokens seguros (4-6 horas + 2-3h prep)
    - **Depende de:** #1, #6 (ya resueltos en Fase 1)
    - **Preparación:** Crear modelo (30min) + planificar estrategia (2h)

11. **CRÍTICO #3** - Validación de uploads (3-4 horas + 2-2.5h prep)
    - **Preparación:** Auditoría de uploads (2h) + definir política (30min)

12. **CRÍTICO #9** - Transacciones en operaciones críticas (4-5 horas + 4.5-5.5h prep)
    - **Preparación:** Auditoría exhaustiva de controladores (4-5h)

13. **CRÍTICO #10** - Validación de entrada (6-8 horas + 4h prep)
    - **Preparación:** Decidir librería (30min) + auditoría (3.5h)

14. **CRÍTICO #13** - Logging estructurado (3-4 horas + 2-2.5h prep)
    - **Preparación:** Decidir librería (30min) + auditoría (2h)

**Total Fase 2:** ~22-35 horas de trabajo + ~18-22 horas de preparación = **40-57 horas totales**

---

### Fase 3: Bloqueados (🔴 Requieren Fase 1 y 2 completas)

15. **CRÍTICO #5** - Migración de localStorage a cookies (4-5 horas + 8-12h prep)
    - **Depende de:** #1, #2, #6, #8 (todos deben estar resueltos)
    - **Preparación:** Resolver dependencias (7-10h) + auditoría (1h) + planificación (1h)
    - **NO INICIAR** hasta que Fase 1 y 2 estén completas

**Total Fase 3:** ~12-17 horas (solo después de Fase 1 y 2)

---

## RESUMEN EJECUTIVO FINAL

### ✅ Qué se puede empezar YA (🟢)

**8 problemas críticos** listos para iniciar inmediatamente:

1. **#15** - Error de sintaxis (5 min)
2. **#1** - JWT_SECRET (30 min) ⭐ **PRIORIDAD MÁXIMA**
3. **#6** - Endpoint `/auth/me` (1 hora) ⭐ **PRIORIDAD ALTA** (desbloquea otros)
4. **#4** - CORS (30 min)
5. **#7** - Credenciales DB (1 hora)
6. **#11** - Rate limiting (1-2 horas)
7. **#12** - Helmet (30 min)
8. **#14** - Dependencias (1 hora)

**Tiempo total:** ~6-8 horas de trabajo efectivo

**Recomendación:** Empezar con **#1 y #6** (base de autenticación), luego los demás en paralelo.

---

### ⚠️ Qué necesita preparación previa (🟡)

**6 problemas críticos** que requieren auditoría/planificación:

1. **#8** - Unificar clientes/auth (prep: 3.5-4h, trabajo: 2-3h)
2. **#2** - Refresh tokens (prep: 2-3h, trabajo: 4-6h)
3. **#3** - Validación uploads (prep: 2-2.5h, trabajo: 3-4h)
4. **#9** - Transacciones (prep: 4.5-5.5h, trabajo: 4-5h)
5. **#10** - Validación entrada (prep: 4h, trabajo: 6-8h)
6. **#13** - Logging (prep: 2-2.5h, trabajo: 3-4h)

**Tiempo total de preparación:** ~18-22 horas  
**Tiempo total de trabajo:** ~22-35 horas  
**Total:** ~40-57 horas

**Recomendación:** Hacer preparación en paralelo con Fase 1, luego ejecutar trabajos.

---

### 🚫 Qué está bloqueado completamente (🔴)

**1 problema crítico** que NO puede iniciarse aún:

1. **#5** - Migración localStorage → cookies
   - **Bloqueado por:** #1, #2, #6, #8
   - **No iniciar hasta:** Fase 1 y 2 completas
   - **Tiempo estimado:** 12-17 horas (después de desbloquear)

---

### 📊 Estimación total del "pre-work" necesario

**Preparación necesaria antes de tocar código crítico:**

- **Fase 1 (🟢):** ~1-2 horas de preparación menor
  - Verificaciones rápidas, documentación
- **Fase 2 (🟡):** ~18-22 horas de preparación
  - Auditorías exhaustivas, planificación
- **Fase 3 (🔴):** ~8-12 horas de preparación
  - Solo después de resolver dependencias

**Total pre-work:** ~27-36 horas de preparación

**Trabajo real después de preparación:**
- Fase 1: ~6-8 horas
- Fase 2: ~22-35 horas  
- Fase 3: ~12-17 horas (después de desbloquear)

**Total trabajo:** ~40-60 horas

**TOTAL GENERAL (prep + trabajo):** ~67-96 horas

---

### 🎯 Recomendación Estratégica

**Para MVP mínimo viable (solo seguridad crítica):**

1. **Día 1-2:** Fase 1 completa (🟢) - 6-8 horas
   - Resuelve 8 problemas críticos de seguridad básica
   - Desbloquea trabajos de autenticación

2. **Día 3-5:** Fase 2 parcial (🟡) - Priorizar:
   - **#8** (unificar auth) - Desbloquea #5
   - **#2** (refresh tokens) - Completa seguridad auth
   - **#3** (validación uploads) - Seguridad crítica

3. **Día 6+:** Fase 3 (#5) solo después de #8 resuelto

**MVP mínimo:** Fase 1 completa = **6-8 horas**  
**MVP robusto:** Fase 1 + #8 + #2 + #3 = **~20-25 horas**

---

**Fin del Reporte de Evaluación de Preparación**

