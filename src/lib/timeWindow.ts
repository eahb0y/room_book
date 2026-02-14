export const ROOM_TIME_STEP_MINUTES = 15;
export const MINUTES_IN_DAY = 24 * 60;

export const DEFAULT_ROOM_AVAILABLE_FROM = '00:00';
export const DEFAULT_ROOM_AVAILABLE_TO = '24:00';

const HH_MM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const toHHMM = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length < 5) return null;

  const candidate = trimmed.slice(0, 5);
  if (candidate === '24:00') return candidate;
  if (!HH_MM_PATTERN.test(candidate)) return null;
  return candidate;
};

export const normalizeTime = (
  value: string | null | undefined,
  fallback: string,
) => {
  if (typeof value !== 'string') return fallback;
  return toHHMM(value) ?? fallback;
};

export const toMinutes = (time: string) => {
  if (time === '24:00') return MINUTES_IN_DAY;

  const [hour, minute] = time.split(':');
  const parsedHour = parseInt(hour ?? '0', 10);
  const parsedMinute = parseInt(minute ?? '0', 10);

  return parsedHour * 60 + parsedMinute;
};

export const toTime = (totalMinutes: number) => {
  const bounded = Math.max(0, Math.min(MINUTES_IN_DAY, Math.round(totalMinutes)));
  if (bounded >= MINUTES_IN_DAY) return '24:00';

  const hour = Math.floor(bounded / 60).toString().padStart(2, '0');
  const minute = (bounded % 60).toString().padStart(2, '0');
  return `${hour}:${minute}`;
};

export const normalizeRoomAvailability = (
  availableFrom: string | null | undefined,
  availableTo: string | null | undefined,
) => {
  const normalizedFrom = normalizeTime(availableFrom, DEFAULT_ROOM_AVAILABLE_FROM);
  const normalizedTo = normalizeTime(availableTo, DEFAULT_ROOM_AVAILABLE_TO);

  if (toMinutes(normalizedFrom) >= toMinutes(normalizedTo)) {
    return {
      availableFrom: DEFAULT_ROOM_AVAILABLE_FROM,
      availableTo: DEFAULT_ROOM_AVAILABLE_TO,
    };
  }

  return {
    availableFrom: normalizedFrom,
    availableTo: normalizedTo,
  };
};
