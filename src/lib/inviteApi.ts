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

interface MembershipRow {
  id: string;
}

type RedeemResponse = { success: boolean; venueId?: string; invitationId?: string };

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

const ensureMembership = async (venueId: string, userId: string, invitationId: string) => {
  const existing = await supabaseDbRequest<MembershipRow[]>(
    `venue_memberships?select=id&venue_id=eq.${encodeURIComponent(venueId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    { method: 'GET' },
  );

  if (existing[0]) return;

  try {
    await supabaseDbRequest<MembershipRow[]>(
      'venue_memberships',
      {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify([
          {
            venue_id: venueId,
            user_id: userId,
            role: 'member',
            invitation_id: invitationId,
          },
        ]),
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : '';
    if (message.includes('duplicate key')) {
      return;
    }
    throw err;
  }
};

const isInvitationValid = (invitation: InvitationRow) => {
  if (invitation.revoked_at) return false;
  if (invitation.expires_at && new Date(invitation.expires_at) <= new Date()) return false;
  if (invitation.max_uses !== null && invitation.uses >= invitation.max_uses) return false;
  return true;
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

export const redeemInvitation = async (token: string, userId: string, userEmail?: string): Promise<RedeemResponse> => {
  const invitation = await getInvitationRowByToken(token);
  if (!invitation) {
    throw new Error('Приглашение не найдено или удалено');
  }

  if (invitation.invitee_user_id && invitation.invitee_user_id !== userId) {
    throw new Error('Приглашение предназначено для другого пользователя');
  }

  if (invitation.status === 'connected') {
    if (invitation.connected_user_id === userId) {
      await ensureMembership(invitation.venue_id, userId, invitation.id);
      return {
        success: true,
        venueId: invitation.venue_id,
        invitationId: invitation.id,
      };
    }
    throw new Error('Приглашение уже использовано');
  }

  const normalizedInviteEmail = normalizeEmail(invitation.invitee_email ?? undefined);
  const normalizedUserEmail = normalizeEmail(userEmail);

  if (normalizedInviteEmail && normalizedUserEmail && normalizedInviteEmail !== normalizedUserEmail) {
    throw new Error('Приглашение предназначено для другого email');
  }

  if (!isInvitationValid(invitation)) {
    throw new Error('Приглашение недействительно');
  }

  await ensureMembership(invitation.venue_id, userId, invitation.id);

  await supabaseDbRequest<InvitationRow[]>(
    `invitations?id=eq.${encodeURIComponent(invitation.id)}`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        uses: invitation.uses + 1,
        status: 'connected',
        connected_at: new Date().toISOString(),
        connected_user_id: userId,
        invitee_user_id: invitation.invitee_user_id ?? userId,
      }),
    },
  );

  return {
    success: true,
    venueId: invitation.venue_id,
    invitationId: invitation.id,
  };
};
