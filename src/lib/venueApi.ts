import type { Venue } from '@/types';
import { supabaseDbRequest } from '@/lib/supabaseHttp';

interface VenueRow {
  id: string;
  name: string;
  description: string;
  address: string;
  admin_id: string;
  created_at: string;
}

const mapVenue = (row: VenueRow): Venue => ({
  id: row.id,
  name: row.name,
  description: row.description,
  address: row.address,
  adminId: row.admin_id,
  createdAt: row.created_at,
});

export const listVenues = async (params?: { adminId?: string; userId?: string }) => {
  if (params?.adminId) {
    const rows = await supabaseDbRequest<VenueRow[]>(
      `venues?select=*&admin_id=eq.${encodeURIComponent(params.adminId)}&order=created_at.desc`,
      { method: 'GET' },
    );

    return rows.map(mapVenue);
  }

  if (params?.userId) {
    const rows = await supabaseDbRequest<Array<{ venues: VenueRow | null }>>(
      `venue_memberships?select=venues(*)&user_id=eq.${encodeURIComponent(params.userId)}`,
      { method: 'GET' },
    );

    const deduped = new Map<string, Venue>();
    rows.forEach((row) => {
      if (!row.venues) return;
      const venue = mapVenue(row.venues);
      deduped.set(venue.id, venue);
    });

    return Array.from(deduped.values());
  }

  const rows = await supabaseDbRequest<VenueRow[]>('venues?select=*&order=created_at.desc', { method: 'GET' });
  return rows.map(mapVenue);
};

export const createVenue = async (payload: {
  name: string;
  description: string;
  address: string;
  adminId: string;
}) => {
  const rows = await supabaseDbRequest<VenueRow[]>(
    'venues',
    {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify([
        {
          name: payload.name,
          description: payload.description,
          address: payload.address,
          admin_id: payload.adminId,
        },
      ]),
    },
  );

  const created = rows[0];
  if (!created) throw new Error('Venue was not created');

  return mapVenue(created);
};

export const updateVenue = async (id: string, payload: Partial<Pick<Venue, 'name' | 'description' | 'address'>>) => {
  const patch: Record<string, unknown> = {};
  if (payload.name !== undefined) patch.name = payload.name;
  if (payload.description !== undefined) patch.description = payload.description;
  if (payload.address !== undefined) patch.address = payload.address;

  const rows = await supabaseDbRequest<VenueRow[]>(
    `venues?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify(patch),
    },
  );

  const updated = rows[0];
  if (!updated) throw new Error('Venue not found');

  return mapVenue(updated);
};
