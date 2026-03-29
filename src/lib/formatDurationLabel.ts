type TranslateFn = (value: string, params?: Record<string, string | number>) => string;

export const formatDurationLabel = (minutes: number, t: TranslateFn) => {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  if (hours > 0 && restMinutes > 0) {
    return t('{hours} ч {minutes} мин', { hours, minutes: restMinutes });
  }

  if (hours > 0) {
    return t('{hours} ч', { hours });
  }

  return t('{minutes} мин', { minutes: restMinutes });
};
