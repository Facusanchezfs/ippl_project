'use strict';

function toMinutesHHMM(hhmm) {
  const [h, m] = String(hhmm || '')
    .split(':')
    .map((x) => parseInt(x, 10));
  const hh = Number.isFinite(h) ? h : NaN;
  const mm = Number.isFinite(m) ? m : NaN;
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function formatMinutesToHHMM(totalMinutes) {
  const mins = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

/**
 * Centralized rule: startTime + durationMinutes -> endTime (HH:mm).
 *
 * Business constraint (matches Appointment.validate timeOrder):
 * - endTime must be strictly greater than startTime on the SAME `date`.
 * - cross-midnight intervals are NOT representable with (date + HH:mm) model,
 *   so they are rejected by default.
 */
function computeEndTimeFromStartAndDuration(startTime, durationMinutes, options) {
  const allowCrossMidnight = options?.allowCrossMidnight ?? false;

  const startMinutes = toMinutesHHMM(startTime);
  if (startMinutes === null) {
    throw new Error(`Invalid startTime format: ${startTime}`);
  }

  const duration = Number(durationMinutes);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Invalid durationMinutes: ${durationMinutes}`);
  }

  const endMinutes = startMinutes + duration;

  if (!allowCrossMidnight && endMinutes >= 24 * 60) {
    throw new Error(
      `La duración cruza medianoche (startTime=${startTime}, duration=${durationMinutes}).`
    );
  }

  if (endMinutes <= startMinutes) {
    throw new Error(
      `endTime inválido (endMinutes<=startMinutes): startTime=${startTime}, duration=${durationMinutes}`
    );
  }

  if (allowCrossMidnight) {
    return {
      startMinutes,
      endMinutes,
      endTime: formatMinutesToHHMM(endMinutes),
    };
  }

  // No cross-midnight => endMinutes is within same day.
  return {
    startMinutes,
    endMinutes,
    endTime: formatMinutesToHHMM(endMinutes),
  };
}

function isTimeRangeValidHHMM(startTime, endTime) {
  const s = toMinutesHHMM(startTime);
  const e = toMinutesHHMM(endTime);
  if (s === null || e === null) return false;
  return e > s;
}

module.exports = {
  toMinutesHHMM,
  formatMinutesToHHMM,
  computeEndTimeFromStartAndDuration,
  isTimeRangeValidHHMM,
};

