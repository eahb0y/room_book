import type { BusinessStaffAccount, BusinessStaffRole, CreatedBusinessStaffAccount } from '@/types';
import { supabaseDbRequest } from '@/lib/supabaseHttp';

interface BusinessStaffAccountRow {
  id: string;
  venue_id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: BusinessStaffRole;
  created_by_user_id: string;
  created_at: string;
  venues: {
    name: string;
  } | null;
}

interface CreateBusinessStaffAccountRpcRow extends Omit<BusinessStaffAccountRow, 'venues'> {
  temporary_password: string;
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

const isMissingBusinessStaffSchemaError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    (message.includes('business_staff_accounts') || message.includes('create_business_staff_account'))
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

const normalizeBusinessStaffError = (error: unknown) => {
  if (isMissingBusinessStaffSchemaError(error)) {
    return new Error(
      'Таблица сотрудников ещё не создана в Supabase. Примените миграцию 20260301120000_business_staff_accounts_and_roles.sql и обновите schema cache.',
    );
  }

  return error instanceof Error ? error : new Error('Не удалось выполнить операцию с сотрудниками');
};

const mapBusinessStaffAccount = (row: BusinessStaffAccountRow): BusinessStaffAccount => ({
  id: row.id,
  venueId: row.venue_id,
  venueName: row.venues?.name ?? undefined,
  userId: row.user_id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  role: row.role,
  createdByUserId: row.created_by_user_id,
  createdAt: row.created_at,
});

const mapCreatedBusinessStaffAccount = (row: CreateBusinessStaffAccountRpcRow): CreatedBusinessStaffAccount => ({
  id: row.id,
  venueId: row.venue_id,
  userId: row.user_id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  role: row.role,
  createdByUserId: row.created_by_user_id,
  createdAt: row.created_at,
  temporaryPassword: row.temporary_password,
});

export const listBusinessStaffAccounts = async (params?: { venueId?: string; userId?: string }) => {
  try {
    const filters = ['select=*,venues(name)', 'order=created_at.asc'];
    if (params?.venueId) filters.push(`venue_id=eq.${encodeURIComponent(params.venueId)}`);
    if (params?.userId) filters.push(`user_id=eq.${encodeURIComponent(params.userId)}`);

    const rows = await supabaseDbRequest<BusinessStaffAccountRow[]>(
      `business_staff_accounts?${filters.join('&')}`,
      { method: 'GET' },
    );

    return rows.map(mapBusinessStaffAccount);
  } catch (error) {
    throw normalizeBusinessStaffError(error);
  }
};

export const createBusinessStaffAccount = async (payload: {
  venueId: string;
  firstName: string;
  lastName: string;
  role: BusinessStaffRole;
  email: string;
}) => {
  try {
    const rows = await supabaseDbRequest<CreateBusinessStaffAccountRpcRow[]>(
      'rpc/create_business_staff_account',
      {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          p_venue_id: payload.venueId,
          p_first_name: payload.firstName,
          p_last_name: payload.lastName,
          p_role: payload.role,
          p_email: payload.email,
        }),
      },
    );

    const created = rows[0];
    if (!created) {
      throw new Error('Не удалось создать сотрудника');
    }

    return mapCreatedBusinessStaffAccount(created);
  } catch (error) {
    throw normalizeBusinessStaffError(error);
  }
};

export const updateBusinessStaffAccountRole = async (payload: { accountId: string; role: BusinessStaffRole }) => {
  try {
    const rows = await supabaseDbRequest<BusinessStaffAccountRow[]>(
      'rpc/update_business_staff_account_role',
      {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          p_staff_account_id: payload.accountId,
          p_role: payload.role,
        }),
      },
    );

    const updated = rows[0];
    if (!updated) {
      throw new Error('Не удалось обновить роль сотрудника');
    }

    return mapBusinessStaffAccount({ ...updated, venues: null });
  } catch (error) {
    throw normalizeBusinessStaffError(error);
  }
};

export const deleteBusinessStaffAccount = async (accountId: string) => {
  try {
    await supabaseDbRequest<unknown>(
      'rpc/delete_business_staff_account',
      {
        method: 'POST',
        body: JSON.stringify({
          p_staff_account_id: accountId,
        }),
      },
    );
  } catch (error) {
    throw normalizeBusinessStaffError(error);
  }
};
