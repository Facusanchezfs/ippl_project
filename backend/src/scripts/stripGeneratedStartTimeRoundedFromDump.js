'use strict';

/**
 * Quita `startTimeRounded` de los INSERT de `Appointments` en un mysqldump,
 * para evitar ERROR 3105 al restaurar (columna GENERATED STORED vs valores del dump).
 *
 * Uso:
 *   node src/scripts/stripGeneratedStartTimeRoundedFromDump.js <entrada.sql> [salida.sql]
 *
 * Si no pasás salida, escribe junto al entrada: <nombre>_nostarttime.sql
 */

const fs = require('fs');
const path = require('path');

function stripLastFieldAtDepth0(tupleContent) {
  let depth = 0;
  let inString = false;
  let lastComma = -1;
  for (let i = 0; i < tupleContent.length; i += 1) {
    const c = tupleContent[i];
    if (inString) {
      if (c === '\\') {
        i += 1;
        continue;
      }
      if (c === "'") inString = false;
      continue;
    }
    if (c === "'") {
      inString = true;
      continue;
    }
    if (c === '(') depth += 1;
    else if (c === ')') depth -= 1;
    else if (c === ',' && depth === 0) lastComma = i;
  }
  if (lastComma === -1) return tupleContent;
  return tupleContent.slice(0, lastComma);
}

function fixAppointmentsInsertLine(line) {
  const needle = ') VALUES (';
  const idx = line.indexOf(needle);
  if (idx === -1) return line;

  const prefix = line
    .slice(0, idx)
    .replace(/,\s*`startTimeRounded`\s*$/i, '');
  let out = prefix + needle;

  const after = line.slice(idx + needle.length);
  if (!after.endsWith(');')) return line;
  const tuple = after.slice(0, -2);
  out += stripLastFieldAtDepth0(tuple) + ');';
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 1) {
    console.error('Uso: node stripGeneratedStartTimeRoundedFromDump.js <entrada.sql> [salida.sql]');
    process.exit(1);
  }
  const inputPath = path.resolve(argv[0]);
  const outputPath = argv[1]
    ? path.resolve(argv[1])
    : inputPath.replace(/\.sql$/i, '_nostarttime.sql');

  if (!fs.existsSync(inputPath)) {
    console.error('No existe el archivo:', inputPath);
    process.exit(1);
  }

  const text = fs.readFileSync(inputPath, 'utf8');
  const lines = text.split(/\r?\n/);
  let changed = 0;

  const outLines = lines.map((line) => {
    if (!line.includes('INSERT INTO `Appointments`') || !line.includes('`startTimeRounded`')) {
      return line;
    }
    const next = fixAppointmentsInsertLine(line);
    if (next !== line) changed += 1;
    return next;
  });

  fs.writeFileSync(outputPath, outLines.join('\n'), 'utf8');
  console.log(`Listo: ${changed} líneas INSERT de Appointments ajustadas.`);
  console.log('Salida:', outputPath);
}

main();
