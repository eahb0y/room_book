import { backendRequest } from '@/lib/backendHttp';

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

export const createTelegramBotActivation = async (venueId: string): Promise<TelegramBotActivation> => {
  return backendRequest<TelegramBotActivation>(
    '/api/telegram-bot/activation',
    {
      method: 'POST',
      body: { venueId },
    },
  );
};

export const getTelegramBotConnectionStatus = async (venueId: string): Promise<TelegramBotConnectionStatus> => {
  const searchParams = new URLSearchParams({ venueId });
  return backendRequest<TelegramBotConnectionStatus>(
    `/api/telegram-bot/status?${searchParams.toString()}`,
    { method: 'GET' },
  );
};
