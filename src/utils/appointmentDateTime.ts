export function combineLocalDateTime(dateStr: string, timeStr?: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  let hh = 0;
  let mm = 0;
  if (timeStr) {
    [hh, mm] = timeStr.split(':').map(Number);
  }
  return new Date(y, m - 1, d, hh, mm);
}

export function formatAppointmentDateTimeEsAR(
  dateStr: string,
  timeStr?: string
): string {
  return combineLocalDateTime(dateStr, timeStr).toLocaleString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
