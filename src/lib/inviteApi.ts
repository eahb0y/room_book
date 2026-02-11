import type { Invitation } from '@/types';
import { request } from '@/lib/apiClient';

type InvitationResponse = { invitation: Invitation };
type InvitationListResponse = { invitations: Invitation[] };
type RedeemResponse = { success: boolean; venueId?: string; invitationId?: string };

export const listInvitations = async (venueId: string) => {
  const data = await request<InvitationListResponse>(`/api/invitations?venueId=${encodeURIComponent(venueId)}`);
  return data.invitations;
};

export const createInvitation = async (payload: {
  venueId: string;
  venueName: string;
  createdByUserId: string;
  inviteeFirstName: string;
  inviteeLastName: string;
  inviteeEmail: string;
  inviteeUserId?: string;
  expiresAt?: string;
  maxUses?: number;
}) => {
  const data = await request<InvitationResponse>('/api/invitations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.invitation;
};

export const updateInvitation = async (
  id: string,
  updates: { expiresAt?: string | null; maxUses?: number | null }
) => {
  const data = await request<InvitationResponse>(`/api/invitations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      expiresAt: updates.expiresAt ?? null,
      maxUses: updates.maxUses ?? null,
    }),
  });
  return data.invitation;
};

export const revokeInvitation = async (id: string) => {
  const data = await request<InvitationResponse>(`/api/invitations/${encodeURIComponent(id)}/revoke`, {
    method: 'POST',
  });
  return data.invitation;
};

export const getInvitationByToken = async (token: string) => {
  const data = await request<InvitationResponse>(`/api/invitations/by-token/${encodeURIComponent(token)}`);
  return data.invitation;
};

export const redeemInvitation = async (token: string, userId: string, userEmail?: string) => {
  const data = await request<RedeemResponse>(`/api/invitations/by-token/${encodeURIComponent(token)}/redeem`, {
    method: 'POST',
    body: JSON.stringify({ userId, userEmail }),
  });
  return data;
};
