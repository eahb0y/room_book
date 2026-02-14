import type { VenueMembership } from '@/types';
import { supabaseDbRequest } from '@/lib/supabaseHttp';

interface VenueMembershipRow {
  id: string;
  venue_id: string;
  user_id: string;
  role: 'member' | 'manager';
  joined_at: string;
  invitation_id: string | null;
}

const mapMembership = (row: VenueMembershipRow): VenueMembership => ({
  id: row.id,
  venueId: row.venue_id,
  userId: row.user_id,
  role: row.role,
  joinedAt: row.joined_at,
  invitationId: row.invitation_id ?? undefined,
});

export const listMemberships = async (params?: { userId?: string; venueId?: string }) => {
  const filters: string[] = ['select=*', 'order=joined_at.desc'];
  if (params?.userId) filters.push(`user_id=eq.${encodeURIComponent(params.userId)}`);
  if (params?.venueId) filters.push(`venue_id=eq.${encodeURIComponent(params.venueId)}`);

  const rows = await supabaseDbRequest<VenueMembershipRow[]>(`venue_memberships?${filters.join('&')}`, {
    method: 'GET',
  });

  return rows.map(mapMembership);
};

export const createMembership = async (payload: {
  venueId: string;
  userId: string;
  role?: 'member' | 'manager';
  invitationId?: string;
}) => {
  const rows = await supabaseDbRequest<VenueMembershipRow[]>(
    'venue_memberships',
    {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify([
        {
          venue_id: payload.venueId,
          user_id: payload.userId,
          role: payload.role ?? 'member',
          invitation_id: payload.invitationId ?? null,
        },
      ]),
    },
  );

  const created = rows[0];
  if (!created) throw new Error('Membership was not created');

  return mapMembership(created);
};
