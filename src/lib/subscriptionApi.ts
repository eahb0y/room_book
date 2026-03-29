import type { SubscriptionBillingMode, VenueSubscription } from '@/types';
import { supabaseDbRequest } from '@/lib/supabaseHttp';

interface VenueSubscriptionRow {
  id: string;
  venue_id: string;
  plan_id: string;
  plan_name: string;
  plan_family: 'free' | 'plus' | 'pro';
  billing_cycle: SubscriptionBillingMode;
  max_calendars: number | null;
  price_monthly: number;
  price_annually: number;
  current_calendars_count: number;
  created_at: string;
  updated_at: string;
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    const candidates = [record.message, record.msg, record.detail, record.hint, record.error];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
  }

  return '';
};

const isMissingSubscriptionSchemaError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();

  return (
    (
      message.includes('venue_subscriptions')
      || message.includes('subscription_plans')
      || message.includes('get_venue_subscription_snapshot')
      || message.includes('change_venue_subscription_plan')
    )
    && (
      message.includes('schema cache')
      || message.includes('could not find the table')
      || message.includes('could not find the function')
      || message.includes('relation')
      || message.includes('does not exist')
      || message.includes('pgrst')
      || message.includes('42p01')
      || message.includes('42883')
    )
  );
};

const normalizeSubscriptionError = (error: unknown) => {
  if (isMissingSubscriptionSchemaError(error)) {
    return new Error(
      'Таблицы подписок ещё не созданы в Supabase. Примените миграцию 20260311223000_add_calendar_pricing_and_subscription_limits.sql и обновите schema cache.',
    );
  }

  return error instanceof Error ? error : new Error('Не удалось выполнить операцию с подпиской');
};

const mapVenueSubscription = (row: VenueSubscriptionRow): VenueSubscription => ({
  id: row.id,
  venueId: row.venue_id,
  planId: row.plan_id,
  planName: row.plan_name,
  planFamily: row.plan_family,
  billingCycle: row.billing_cycle,
  maxCalendars: row.max_calendars,
  priceMonthly: row.price_monthly,
  priceAnnually: row.price_annually,
  currentCalendarsCount: row.current_calendars_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const getVenueSubscriptionSnapshot = async (venueId: string) => {
  try {
    const rows = await supabaseDbRequest<VenueSubscriptionRow[]>(
      'rpc/get_venue_subscription_snapshot',
      {
        method: 'POST',
        body: JSON.stringify({
          p_venue_id: venueId,
        }),
      },
    );

    const snapshot = rows[0];
    if (!snapshot) {
      throw new Error('Подписка для бизнеса не найдена');
    }

    return mapVenueSubscription(snapshot);
  } catch (error) {
    throw normalizeSubscriptionError(error);
  }
};

export const changeVenueSubscriptionPlan = async (payload: {
  venueId: string;
  planId: string;
  billingCycle: SubscriptionBillingMode;
}) => {
  try {
    const rows = await supabaseDbRequest<VenueSubscriptionRow[]>(
      'rpc/change_venue_subscription_plan',
      {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          p_venue_id: payload.venueId,
          p_plan_id: payload.planId,
          p_billing_cycle: payload.billingCycle,
        }),
      },
    );

    const updated = rows[0];
    if (!updated) {
      throw new Error('Не удалось обновить тариф');
    }

    return mapVenueSubscription(updated);
  } catch (error) {
    throw normalizeSubscriptionError(error);
  }
};
