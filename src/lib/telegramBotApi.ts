import { supabaseDbRequest } from '@/lib/supabaseHttp';
import { debugError, debugInfo } from '@/lib/frontendDebug';

type RpcRow<T> = T | T[] | null | undefined;

interface TelegramBotActivationRpcRow {
  token?: string;
  expires_at?: string;
  expiresAt?: string;
}

interface TelegramBotConnectionStatusRpcRow {
  venue_id?: string;
  venueId?: string;
  is_connected?: boolean;
  isConnected?: boolean;
  chat_label?: string | null;
  chatLabel?: string | null;
  connected_at?: string | null;
  connectedAt?: string | null;
  last_notification_at?: string | null;
  lastNotificationAt?: string | null;
}

export interface TelegramBotActivation {
  token: string;
  expiresAt: string;
}

export interface TelegramBotConnectionStatus {
  venueId: string;
  isConnected: boolean;
  chatLabel?: string;
  connectedAt?: string;
  lastNotificationAt?: string;
}

const unwrapRpcRow = <T>(payload: RpcRow<T>) => {
  if (Array.isArray(payload)) {
    return payload[0] ?? null;
  }

  return payload ?? null;
};

export const createTelegramBotActivation = async (venueId: string): Promise<TelegramBotActivation> => {
  debugInfo('telegram.activation.request.started', {
    venueId,
  });

  let response: RpcRow<TelegramBotActivationRpcRow>;
  try {
    response = await supabaseDbRequest<RpcRow<TelegramBotActivationRpcRow>>(
      'rpc/create_telegram_bot_activation',
      {
        method: 'POST',
        body: JSON.stringify({
          p_venue_id: venueId,
        }),
      },
    );
  } catch (error) {
    debugError('telegram.activation.request.failed', {
      venueId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const row = unwrapRpcRow(response);
  const token = row?.token;
  const expiresAt = row?.expiresAt ?? row?.expires_at;

  if (!token || !expiresAt) {
    debugError('telegram.activation.request.invalid_payload', {
      venueId,
      response,
    });
    throw new Error('Не удалось создать ссылку для Telegram-бота');
  }

  debugInfo('telegram.activation.request.succeeded', {
    venueId,
    expiresAt,
    tokenLength: token.length,
  });

  return {
    token,
    expiresAt,
  };
};

export const getTelegramBotConnectionStatus = async (venueId: string): Promise<TelegramBotConnectionStatus> => {
  debugInfo('telegram.status.request.started', {
    venueId,
  });

  let response: RpcRow<TelegramBotConnectionStatusRpcRow>;
  try {
    response = await supabaseDbRequest<RpcRow<TelegramBotConnectionStatusRpcRow>>(
      'rpc/get_telegram_bot_connection_status',
      {
        method: 'POST',
        body: JSON.stringify({
          p_venue_id: venueId,
        }),
      },
    );
  } catch (error) {
    debugError('telegram.status.request.failed', {
      venueId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const row = unwrapRpcRow(response);
  if (!row) {
    debugInfo('telegram.status.request.empty', {
      venueId,
    });
    return {
      venueId,
      isConnected: false,
    };
  }

  const status = {
    venueId: row.venueId ?? row.venue_id ?? venueId,
    isConnected: row.isConnected ?? row.is_connected ?? false,
    chatLabel: row.chatLabel ?? row.chat_label ?? undefined,
    connectedAt: row.connectedAt ?? row.connected_at ?? undefined,
    lastNotificationAt: row.lastNotificationAt ?? row.last_notification_at ?? undefined,
  };

  debugInfo('telegram.status.request.succeeded', {
    venueId: status.venueId,
    isConnected: status.isConnected,
    chatLabel: status.chatLabel ?? null,
    connectedAt: status.connectedAt ?? null,
    lastNotificationAt: status.lastNotificationAt ?? null,
  });

  return status;
};
