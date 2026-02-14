import type { Room } from '@/types';
import { supabaseDbRequest } from '@/lib/supabaseHttp';

interface RoomRow {
  id: string;
  venue_id: string;
  name: string;
  capacity: number;
  created_at: string;
}

const mapRoom = (row: RoomRow): Room => ({
  id: row.id,
  venueId: row.venue_id,
  name: row.name,
  capacity: row.capacity,
  createdAt: row.created_at,
});

const toInFilter = (values: string[]) => values.join(',');

export const listRooms = async (params?: { venueId?: string; venueIds?: string[] }) => {
  if (params?.venueId) {
    const rows = await supabaseDbRequest<RoomRow[]>(
      `rooms?select=*&venue_id=eq.${encodeURIComponent(params.venueId)}&order=created_at.desc`,
      { method: 'GET' },
    );

    return rows.map(mapRoom);
  }

  if (params?.venueIds && params.venueIds.length > 0) {
    const rows = await supabaseDbRequest<RoomRow[]>(
      `rooms?select=*&venue_id=in.(${toInFilter(params.venueIds)})&order=created_at.desc`,
      { method: 'GET' },
    );

    return rows.map(mapRoom);
  }

  const rows = await supabaseDbRequest<RoomRow[]>('rooms?select=*&order=created_at.desc', { method: 'GET' });
  return rows.map(mapRoom);
};

export const createRoom = async (payload: { venueId: string; name: string; capacity: number }) => {
  const rows = await supabaseDbRequest<RoomRow[]>(
    'rooms',
    {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify([
        {
          venue_id: payload.venueId,
          name: payload.name,
          capacity: payload.capacity,
        },
      ]),
    },
  );

  const created = rows[0];
  if (!created) throw new Error('Room was not created');

  return mapRoom(created);
};

export const updateRoom = async (id: string, payload: Partial<Pick<Room, 'name' | 'capacity'>>) => {
  const patch: Record<string, unknown> = {};
  if (payload.name !== undefined) patch.name = payload.name;
  if (payload.capacity !== undefined) patch.capacity = payload.capacity;

  const rows = await supabaseDbRequest<RoomRow[]>(
    `rooms?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify(patch),
    },
  );

  const updated = rows[0];
  if (!updated) throw new Error('Room not found');

  return mapRoom(updated);
};

export const deleteRoom = async (id: string) => {
  await supabaseDbRequest<unknown>(`rooms?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal',
    },
  });
};
