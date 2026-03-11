import type { BusinessStaffAccount, BusinessStaffRole, CreatedBusinessStaffAccount } from '@/types';
import { backendRequest } from '@/lib/backendHttp';

const buildQuery = (params?: { venueId?: string; userId?: string }) => {
  const searchParams = new URLSearchParams();
  if (params?.venueId) searchParams.set('venueId', params.venueId);
  if (params?.userId) searchParams.set('userId', params.userId);
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const listBusinessStaffAccounts = async (params?: { venueId?: string; userId?: string }) => {
  return backendRequest<BusinessStaffAccount[]>(
    `/api/business-staff${buildQuery(params)}`,
    { method: 'GET' },
  );
};

export const createBusinessStaffAccount = async (payload: {
  venueId: string;
  firstName: string;
  lastName: string;
  role: BusinessStaffRole;
  email: string;
}) => {
  return backendRequest<CreatedBusinessStaffAccount>(
    '/api/business-staff',
    {
      method: 'POST',
      body: payload,
    },
  );
};

export const updateBusinessStaffAccountRole = async (payload: { accountId: string; role: BusinessStaffRole }) => {
  return backendRequest<BusinessStaffAccount>(
    `/api/business-staff/${encodeURIComponent(payload.accountId)}/role`,
    {
      method: 'PATCH',
      body: { role: payload.role },
    },
  );
};

export const deleteBusinessStaffAccount = async (accountId: string) => {
  await backendRequest<{ id: string; deleted: boolean }>(
    `/api/business-staff/${encodeURIComponent(accountId)}`,
    {
      method: 'DELETE',
    },
  );
};
