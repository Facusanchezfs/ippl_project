'use strict';

/**
 * Zona horaria de referencia para fecha/hora civil de la app (agenda, CRON, filtros).
 * No usar la zona del proceso Node (suele ser UTC en servidor) para comparar con DATEONLY + HH:MM guardados.
 */
const AR_TIMEZONE = 'America/Argentina/Buenos_Aires';

function partsMap(date, options) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: AR_TIMEZONE,
    ...options,
  }).formatToParts(date);
  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return map;
}

/**
 * Fecha civil en Argentina (YYYY-MM-DD), alineada a citas almacenadas como DATEONLY.
 */
function getArgentinaCivilDateString(date = new Date()) {
  const m = partsMap(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  if (!m.year || !m.month || !m.day) {
    throw new Error('getArgentinaCivilDateString: formatToParts incompleto');
  }
  return `${m.year}-${m.month}-${m.day}`;
}

/**
 * Hora en Argentina, HH:MM (24 h), para comparar con columnas TIME de citas.
 */
function getArgentinaTimeHHMM(date = new Date()) {
  const m = partsMap(date, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  });
  if (m.hour == null || m.minute == null) {
    throw new Error('getArgentinaTimeHHMM: formatToParts incompleto');
  }
  const h = String(parseInt(m.hour, 10)).padStart(2, '0');
  const min = String(parseInt(m.minute, 10)).padStart(2, '0');
  return `${h}:${min}`;
}

/**
 * Día de la semana en español (Argentina), p. ej. "lunes", "domingo".
 * Útil para reglas de negocio (cron: domingo sin backlog, etc.).
 */
function getArgentinaWeekdayLongEs(date = new Date()) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: AR_TIMEZONE,
    weekday: 'long',
  }).format(date);
}

/** Fecha almacenada como DATE / DATEONLY (solo dígitos y guiones, sin componente horario ISO). */
const MYSQL_DATEONLY_FULL = /^\d{4}-\d{2}-\d{2}$/;
/** Prefijo de fecha en DATETIME de MySQL (`YYYY-MM-DD HH:MM:SS`). */
const MYSQL_DATETIME_PREFIX = /^(\d{4}-\d{2}-\d{2})[\s]\d/;
/** Indica instante ISO / RFC3339 (no confundir con DATEONLY puro). */
function looksLikeIsoInstantString(s) {
  return (
    s.includes('T') ||
    /Z$/i.test(s) ||
    /[+-]\d{2}:?\d{2}$/.test(s)
  );
}

/**
 * Convierte valores típicos de `Appointment.date` (DATEONLY de MySQL, `Date` de Sequelize,
 * cadena ISO con zona) a `YYYY-MM-DD` en **calendario civil de Argentina**.
 *
 * - `Date`: siempre vía `Intl` en `America/Argentina/Buenos_Aires` (misma base que `getArgentinaCivilDateString`).
 * - Cadena `YYYY-MM-DD` sola: se devuelve tal cual (semántica de fecha civil guardada, sin reinterpretar por UTC).
 * - Cadena tipo MySQL `YYYY-MM-DD HH:MM:SS`: se usa el prefijo de fecha civil.
 * - Cadenas con instante ISO (`T` / `Z` / offset): se interpretan como instante y se proyectan a calendario AR.
 *
 * No usa `String(val).slice(0, 10)` sobre valores arbitrarios.
 */
function normalizeToArgentinaCivilYmd(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    /**
     * `DATEONLY` suele llegar como `Date` en medianoche **UTC** (p. ej. `2026-04-24` →
     * `2026-04-23T21:00:00-03:00` en AR). `Intl` en Argentina daría el día **anterior** al
     * guardado en MySQL. Para ese patrón usamos el calendario UTC del instante (= fecha SQL).
     */
    const uH = value.getUTCHours();
    const uM = value.getUTCMinutes();
    const uS = value.getUTCSeconds();
    const uMs = value.getUTCMilliseconds();
    if (uH === 0 && uM === 0 && uS === 0 && uMs === 0) {
      const y = value.getUTCFullYear();
      const mo = String(value.getUTCMonth() + 1).padStart(2, '0');
      const da = String(value.getUTCDate()).padStart(2, '0');
      return `${y}-${mo}-${da}`;
    }
    return getArgentinaCivilDateString(value);
  }
  if (typeof value !== 'string') return '';
  const s = value.trim();
  if (!s) return '';
  if (MYSQL_DATEONLY_FULL.test(s)) {
    return s;
  }
  const sqlPrefix = MYSQL_DATETIME_PREFIX.exec(s);
  if (sqlPrefix) {
    return sqlPrefix[1];
  }
  if (looksLikeIsoInstantString(s)) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    return getArgentinaCivilDateString(d);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return getArgentinaCivilDateString(d);
}

module.exports = {
  AR_TIMEZONE,
  getArgentinaCivilDateString,
  getArgentinaTimeHHMM,
  getArgentinaWeekdayLongEs,
  normalizeToArgentinaCivilYmd,
  /** Alias explícitos (misma implementación que getArgentina*). */
  getLocalDateString: getArgentinaCivilDateString,
  getLocalTimeHHMM: getArgentinaTimeHHMM,
};
