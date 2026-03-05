const DEBUG_PREFIX = '[tezbron-debug]';

const toLogPayload = (details?: Record<string, unknown>) => ({
  at: new Date().toISOString(),
  ...(details ?? {}),
});

const formatEvent = (event: string) => `${DEBUG_PREFIX} ${event}`;

export const debugInfo = (event: string, details?: Record<string, unknown>) => {
  console.info(formatEvent(event), toLogPayload(details));
};

export const debugWarn = (event: string, details?: Record<string, unknown>) => {
  console.warn(formatEvent(event), toLogPayload(details));
};

export const debugError = (event: string, details?: Record<string, unknown>) => {
  console.error(formatEvent(event), toLogPayload(details));
};
