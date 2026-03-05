import type { Venue } from '@/types';
import { supabaseDbRequest } from '@/lib/supabaseHttp';

interface VenueRow {
  id: string;
  name: string;
  description: string;
  address: string;
  activity_type?: string | null;
  admin_id: string;
  created_at: string;
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

const isMissingColumnError = (error: unknown, columnName: string) => {
  const message = getErrorMessage(error).toLowerCase();
  if (!message.includes(columnName.toLowerCase())) return false;

  return (
    message.includes('schema cache')
    || message.includes('does not exist')
    || message.includes('could not find the')
    || message.includes('pgrst204')
    || message.includes('42703')
  );
};

const mapVenue = (row: VenueRow): Venue => ({
  id: row.id,
  name: row.name,
  description: row.description,
  address: row.address,
  activityType: row.activity_type ?? '',
  adminId: row.admin_id,
  createdAt: row.created_at,
});

const toInFilter = (values: string[]) => values.join(',');

const fetchVenueById = async (id: string) => {
  const rows = await supabaseDbRequest<VenueRow[]>(
    `venues?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
    { method: 'GET' },
  );

  const venue = rows[0];
  if (!venue) throw new Error('Заведение не найдено');
  return mapVenue(venue);
};

export const listVenues = async (params?: { adminId?: string; userId?: string; venueIds?: string[]; publicAccess?: boolean }) => {
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

  if (params?.venueIds && params.venueIds.length > 0) {
    const rows = await supabaseDbRequest<VenueRow[]>(
      `venues?select=*&id=in.(${toInFilter(params.venueIds)})&order=created_at.desc`,
      { method: 'GET' },
      { requireAuth: !params.publicAccess },
    );

    return rows.map(mapVenue);
  }

  const rows = await supabaseDbRequest<VenueRow[]>(
    'venues?select=*&order=created_at.desc',
    { method: 'GET' },
    { requireAuth: !params?.publicAccess },
  );
  return rows.map(mapVenue);
};

export const createVenue = async (payload: {
  name: string;
  description: string;
  address: string;
  activityType?: string;
  adminId: string;
}) => {
  const insertPayload: Record<string, unknown> = {
    name: payload.name,
    description: payload.description,
    address: payload.address,
    activity_type: payload.activityType ?? '',
    admin_id: payload.adminId,
  };

  let rows: VenueRow[];
  try {
    rows = await supabaseDbRequest<VenueRow[]>(
      'venues',
      {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify([insertPayload]),
      },
    );
  } catch (error) {
    if (!isMissingColumnError(error, 'activity_type')) {
      throw error;
    }

    delete insertPayload.activity_type;

    rows = await supabaseDbRequest<VenueRow[]>(
      'venues',
      {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify([insertPayload]),
      },
    );
  }

  const created = rows[0];
  if (!created) throw new Error('Не удалось создать заведение');

  return mapVenue(created);
};

export const updateVenue = async (id: string, payload: Partial<Pick<Venue, 'name' | 'description' | 'address' | 'activityType'>>) => {
  const patch: Record<string, unknown> = {};
  if (payload.name !== undefined) patch.name = payload.name;
  if (payload.description !== undefined) patch.description = payload.description;
  if (payload.address !== undefined) patch.address = payload.address;
  if (payload.activityType !== undefined) patch.activity_type = payload.activityType;

  if (Object.keys(patch).length === 0) {
    return fetchVenueById(id);
  }

  let rows: VenueRow[];
  try {
    rows = await supabaseDbRequest<VenueRow[]>(
      `venues?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify(patch),
      },
    );
  } catch (error) {
    if (!isMissingColumnError(error, 'activity_type') || !Object.prototype.hasOwnProperty.call(patch, 'activity_type')) {
      throw error;
    }

    delete patch.activity_type;

    if (Object.keys(patch).length === 0) {
      return fetchVenueById(id);
    }

    rows = await supabaseDbRequest<VenueRow[]>(
      `venues?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify(patch),
      },
    );
  }

  const updated = rows[0];
  if (!updated) throw new Error('Заведение не найдено');

  return mapVenue(updated);
};
