#!/usr/bin/env node

const normalizeEnv = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveAppEnv = () => {
  const raw = normalizeEnv(process.env.APP_ENV ?? process.env.VITE_APP_ENV)?.toLowerCase();
  if (raw === 'development') return 'dev';
  if (raw === 'production') return 'prod';
  if (raw === 'dev' || raw === 'prod') return raw;
  return 'dev';
};

const APP_ENV = resolveAppEnv();

const resolveSupabaseUrl = () => {
  const explicit = normalizeEnv(process.env.SUPABASE_URL);
  if (explicit) return explicit.replace(/\/+$/, '');

  if (APP_ENV === 'dev') {
    return (
      normalizeEnv(process.env.VITE_SUPABASE_DEV_URL)
      ?? normalizeEnv(process.env.VITE_SUPABASE_URL)
      ?? normalizeEnv(process.env.VITE_SUPABASE_PROD_URL)
    )?.replace(/\/+$/, '');
  }

  return (
    normalizeEnv(process.env.VITE_SUPABASE_PROD_URL)
    ?? normalizeEnv(process.env.VITE_SUPABASE_URL)
    ?? normalizeEnv(process.env.VITE_SUPABASE_DEV_URL)
  )?.replace(/\/+$/, '');
};

const resolveServiceRoleKey = () => {
  const explicit = normalizeEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (explicit) return explicit;

  if (APP_ENV === 'dev') {
    return (
      normalizeEnv(process.env.SUPABASE_DEV_SERVICE_ROLE_KEY)
      ?? normalizeEnv(process.env.SUPABASE_SERVICE_ROLE_DEV_KEY)
      ?? normalizeEnv(process.env.SUPABASE_PROD_SERVICE_ROLE_KEY)
    );
  }

  return (
    normalizeEnv(process.env.SUPABASE_PROD_SERVICE_ROLE_KEY)
    ?? normalizeEnv(process.env.SUPABASE_SERVICE_ROLE_PROD_KEY)
    ?? normalizeEnv(process.env.SUPABASE_DEV_SERVICE_ROLE_KEY)
  );
};

const SUPABASE_URL = resolveSupabaseUrl();
const SUPABASE_SERVICE_ROLE_KEY = resolveServiceRoleKey();
const TELEGRAM_BOT_TOKEN = normalizeEnv(process.env.TELEGRAM_BOT_TOKEN);
const POLL_INTERVAL_MS = parsePositiveInteger(process.env.TELEGRAM_WORKER_INTERVAL_MS, 5000);
const BATCH_SIZE = Math.min(parsePositiveInteger(process.env.TELEGRAM_WORKER_BATCH_SIZE, 20), 100);
const RUN_ONCE = process.argv.includes('--once');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TELEGRAM_BOT_TOKEN) {
  const missing = [
    !SUPABASE_URL ? 'SUPABASE_URL or VITE_SUPABASE_*_URL' : null,
    !SUPABASE_SERVICE_ROLE_KEY ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
    !TELEGRAM_BOT_TOKEN ? 'TELEGRAM_BOT_TOKEN' : null,
  ].filter(Boolean);

  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const log = (message, extra) => {
  const prefix = `[telegram-worker][${new Date().toISOString()}][${APP_ENV}]`;
  if (extra === undefined) {
    console.log(`${prefix} ${message}`);
    return;
  }

  console.log(`${prefix} ${message}`, extra);
};

const supabaseRpc = async (name, body) => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text || null;
  }

  if (!response.ok) {
    const detail =
      (payload && typeof payload === 'object' && (payload.message || payload.error || payload.hint || payload.details))
      || text
      || `HTTP ${response.status}`;
    throw new Error(String(detail));
  }

  return payload;
};

const claimNotifications = async () => {
  const payload = await supabaseRpc('claim_telegram_booking_notifications', {
    p_app_env: APP_ENV,
    p_limit: BATCH_SIZE,
  });

  return Array.isArray(payload) ? payload : [];
};

const completeNotification = async (notificationId, state, error) => {
  await supabaseRpc('complete_telegram_booking_notification', {
    p_notification_id: notificationId,
    p_delivery_state: state,
    p_error: error ?? null,
  });
};

const sendTelegramMessage = async (chatId, messageText) => {
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: messageText,
      disable_web_page_preview: true,
    }),
  });

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text || null;
  }

  if (!response.ok || (payload && typeof payload === 'object' && payload.ok === false)) {
    const description =
      (payload && typeof payload === 'object' && (payload.description || payload.error_code || payload.error))
      || text
      || `HTTP ${response.status}`;
    const error = new Error(String(description));
    error.telegramStatus = response.status;
    throw error;
  }
};

const isPermanentTelegramFailure = (error) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const status = error && typeof error === 'object' && 'telegramStatus' in error
    ? Number(error.telegramStatus)
    : NaN;

  if (status === 400 || status === 403) {
    return true;
  }

  return [
    'chat not found',
    'bot was blocked by the user',
    'user is deactivated',
    'group chat was upgraded',
    'forbidden',
    'not enough rights',
  ].some((part) => message.includes(part));
};

const processNotification = async (notification) => {
  try {
    await sendTelegramMessage(notification.chat_id, notification.message_text);
    await completeNotification(notification.id, 'sent', null);
    log(`sent notification ${notification.id} for booking ${notification.booking_id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const nextState = isPermanentTelegramFailure(error) ? 'skipped' : 'failed';

    try {
      await completeNotification(notification.id, nextState, message);
    } catch (completionError) {
      const completionMessage = completionError instanceof Error ? completionError.message : String(completionError);
      log(`failed to mark notification ${notification.id} as ${nextState}: ${completionMessage}`);
    }

    log(`delivery ${nextState} for notification ${notification.id}: ${message}`);
  }
};

const processBatch = async () => {
  const notifications = await claimNotifications();
  if (notifications.length === 0) {
    return 0;
  }

  log(`claimed ${notifications.length} notification(s)`);

  for (const notification of notifications) {
    await processNotification(notification);
  }

  return notifications.length;
};

const run = async () => {
  log(`worker started${RUN_ONCE ? ' in once mode' : ''}`);

  do {
    try {
      const processedCount = await processBatch();
      if (RUN_ONCE) break;
      await sleep(processedCount > 0 ? 1000 : POLL_INTERVAL_MS);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`worker loop error: ${message}`);
      if (RUN_ONCE) {
        process.exitCode = 1;
        break;
      }
      await sleep(POLL_INTERVAL_MS);
    }
  } while (!RUN_ONCE);
};

void run();
