import type { Invitation } from '@/types';
import { supabaseDbRequest } from '@/lib/supabaseHttp';

interface InvitationRow {
  id: string;
  venue_id: string;
  venue_name: string | null;
  token: string;
  created_by_user_id: string;
  invitee_user_id: string | null;
  invitee_first_name: string | null;
  invitee_last_name: string | null;
  invitee_email: string | null;
  created_at: string;
  expires_at: string | null;
  max_uses: number | null;
  uses: number;
  revoked_at: string | null;
  status: 'pending' | 'connected' | null;
  connected_at: string | null;
  connected_user_id: string | null;
}

type RedeemResponse = { success: boolean; venueId?: string; invitationId?: string };
type RedeemRpcResponse = {
  success?: boolean;
  venueId?: string;
  invitationId?: string;
  venue_id?: string;
  invitation_id?: string;
};

const normalizeEmail = (value?: string) => value?.trim().toLowerCase() ?? '';

const mapInvitation = (row: InvitationRow): Invitation => ({
  id: row.id,
  venueId: row.venue_id,
  venueName: row.venue_name ?? undefined,
  token: row.token,
  createdByUserId: row.created_by_user_id,
  inviteeUserId: row.invitee_user_id ?? undefined,
  inviteeFirstName: row.invitee_first_name ?? undefined,
  inviteeLastName: row.invitee_last_name ?? undefined,
  inviteeEmail: row.invitee_email ?? undefined,
  createdAt: row.created_at,
  expiresAt: row.expires_at ?? undefined,
  maxUses: row.max_uses ?? undefined,
  uses: row.uses,
  revokedAt: row.revoked_at ?? undefined,
  status: row.status ?? undefined,
  connectedAt: row.connected_at ?? undefined,
  connectedUserId: row.connected_user_id ?? undefined,
});

const generateToken = (length = 32) => {
  const alphabet = 'abcdef0123456789';
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
};

const getInvitationRowByToken = async (token: string) => {
  const rows = await supabaseDbRequest<InvitationRow[]>(
    `invitations?select=*&token=eq.${encodeURIComponent(token)}&limit=1`,
    { method: 'GET' },
  );

  return rows[0];
};

export const listInvitations = async (venueId: string) => {
  const rows = await supabaseDbRequest<InvitationRow[]>(
    `invitations?select=*&venue_id=eq.${encodeURIComponent(venueId)}&order=created_at.desc`,
    { method: 'GET' },
  );

  return rows.map(mapInvitation);
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
  const rows = await supabaseDbRequest<InvitationRow[]>(
    'invitations',
    {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify([
        {
          venue_id: payload.venueId,
          venue_name: payload.venueName,
          token: generateToken(40),
          created_by_user_id: payload.createdByUserId,
          invitee_user_id: payload.inviteeUserId ?? null,
          invitee_first_name: payload.inviteeFirstName,
          invitee_last_name: payload.inviteeLastName,
          invitee_email: normalizeEmail(payload.inviteeEmail),
          expires_at: payload.expiresAt ?? null,
          max_uses: payload.maxUses ?? 1,
          uses: 0,
          status: 'pending',
        },
      ]),
    },
  );

  const created = rows[0];
  if (!created) throw new Error('Invitation was not created');

  return mapInvitation(created);
};

export const updateInvitation = async (
  id: string,
  updates: { expiresAt?: string | null; maxUses?: number | null },
) => {
  const patch: Record<string, unknown> = {};
  if (updates.expiresAt !== undefined) patch.expires_at = updates.expiresAt;
  if (updates.maxUses !== undefined) patch.max_uses = updates.maxUses;

  const rows = await supabaseDbRequest<InvitationRow[]>(
    `invitations?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify(patch),
    },
  );

  const updated = rows[0];
  if (!updated) throw new Error('Invitation not found');

  return mapInvitation(updated);
};

export const revokeInvitation = async (id: string) => {
  const rows = await supabaseDbRequest<InvitationRow[]>(
    `invitations?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        revoked_at: new Date().toISOString(),
      }),
    },
  );

  const updated = rows[0];
  if (!updated) throw new Error('Invitation not found');

  return mapInvitation(updated);
};

export const getInvitationByToken = async (token: string) => {
  const invitation = await getInvitationRowByToken(token);
  if (!invitation) {
    throw new Error('Приглашение не найдено');
  }
  return mapInvitation(invitation);
};

export const redeemInvitation = async (token: string): Promise<RedeemResponse> => {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    throw new Error('Не удалось применить приглашение');
  }

  const response = await supabaseDbRequest<RedeemRpcResponse>(
    'rpc/redeem_invitation',
    {
      method: 'POST',
      body: JSON.stringify({
        p_token: normalizedToken,
      }),
    },
  );

  const venueId = response.venueId ?? response.venue_id;
  const invitationId = response.invitationId ?? response.invitation_id;
  const success = response.success === true;

  if (!success || !venueId || !invitationId) {
    throw new Error('Не удалось применить приглашение');
  }

  return {
    success,
    venueId,
    invitationId,
  };
};
