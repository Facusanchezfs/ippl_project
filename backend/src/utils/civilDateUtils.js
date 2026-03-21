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

module.exports = {
  AR_TIMEZONE,
  getArgentinaCivilDateString,
  getArgentinaTimeHHMM,
  /** Alias explícitos (misma implementación que getArgentina*). */
  getLocalDateString: getArgentinaCivilDateString,
  getLocalTimeHHMM: getArgentinaTimeHHMM,
};
