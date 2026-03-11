import type { Invitation } from '@/types';
import { backendRequest } from '@/lib/backendHttp';

type RedeemResponse = { success: boolean; venueId?: string; invitationId?: string };

const normalizeToken = (value: string) => value.trim().toLowerCase();

export const listInvitations = async (venueId: string) => {
  const searchParams = new URLSearchParams({ venueId });
  return backendRequest<Invitation[]>(`/api/invitations?${searchParams.toString()}`, { method: 'GET' });
};

export const createInvitation = async (payload: {
  venueId: string;
  venueName: string;
  createdByUserId: string;
  inviteeFirstName?: string;
  inviteeLastName?: string;
  inviteeEmail?: string;
  inviteeUserId?: string;
  expiresAt?: string;
  maxUses?: number | null;
}) => {
  return backendRequest<Invitation>(
    '/api/invitations',
    {
      method: 'POST',
      body: payload,
    },
  );
};

export const updateInvitation = async (
  id: string,
  updates: { expiresAt?: string | null; maxUses?: number | null },
) => {
  return backendRequest<Invitation>(
    `/api/invitations/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: updates,
    },
  );
};

export const revokeInvitation = async (id: string) => {
  return backendRequest<Invitation>(
    `/api/invitations/${encodeURIComponent(id)}/revoke`,
    {
      method: 'POST',
    },
  );
};

export const getInvitationByToken = async (token: string) => {
  const searchParams = new URLSearchParams({ token: normalizeToken(token) });
  return backendRequest<Invitation>(
    `/api/invitations/preview?${searchParams.toString()}`,
    { method: 'GET' },
    { requireAuth: false },
  );
};

export const redeemInvitation = async (token: string): Promise<RedeemResponse> => {
  return backendRequest<RedeemResponse>(
    '/api/invitations/redeem',
    {
      method: 'POST',
      body: { token: normalizeToken(token) },
    },
  );
};
