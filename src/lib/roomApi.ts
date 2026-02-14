import type { Room } from '@/types';
import { supabaseDbRequest } from '@/lib/supabaseHttp';
import {
  normalizeRoomPhotoUrls,
  serializeRoomPhotoUrlLegacy,
} from '@/lib/roomPhotos';

interface RoomRow {
  id: string;
  venue_id: string;
  name: string;
  capacity: number;
  photo_url: string | null;
  photo_urls?: string[] | null;
  created_at: string;
}

const isPhotoUrlsColumnError = (error: unknown) => {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes('photo_urls')
    || message.includes('42703')
    || message.includes('pgrst204')
    || message.includes('schema cache')
  );
};

const mapRoom = (row: RoomRow): Room => {
  const photoUrls = normalizeRoomPhotoUrls(row.photo_urls, row.photo_url);

  return {
    id: row.id,
    venueId: row.venue_id,
    name: row.name,
    capacity: row.capacity,
    photoUrl: photoUrls[0] ?? null,
    photoUrls,
    createdAt: row.created_at,
  };
};

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

export const createRoom = async (payload: {
  venueId: string;
  name: string;
  capacity: number;
  photoUrls?: string[] | null;
  photoUrl?: string | null;
}) => {
  const photoUrls = normalizeRoomPhotoUrls(payload.photoUrls, payload.photoUrl ?? null);
  const primaryPhotoUrl = photoUrls[0] ?? null;
  let rows: RoomRow[];

  try {
    rows = await supabaseDbRequest<RoomRow[]>(
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
            photo_url: primaryPhotoUrl,
            photo_urls: photoUrls,
          },
        ]),
      },
    );
  } catch (error) {
    if (!isPhotoUrlsColumnError(error)) throw error;

    rows = await supabaseDbRequest<RoomRow[]>(
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
            photo_url: serializeRoomPhotoUrlLegacy(photoUrls),
          },
        ]),
      },
    );
  }

  const created = rows[0];
  if (!created) throw new Error('Room was not created');

  return mapRoom(created);
};

export const updateRoom = async (
  id: string,
  payload: Partial<Pick<Room, 'name' | 'capacity' | 'photoUrl' | 'photoUrls'>>,
) => {
  const patch: Record<string, unknown> = {};
  const shouldPatchPhotos = payload.photoUrls !== undefined || payload.photoUrl !== undefined;
  const normalizedPhotoUrls = shouldPatchPhotos
    ? normalizeRoomPhotoUrls(payload.photoUrls, payload.photoUrl)
    : [];

  if (payload.name !== undefined) patch.name = payload.name;
  if (payload.capacity !== undefined) patch.capacity = payload.capacity;
  if (shouldPatchPhotos) {
    patch.photo_url = normalizedPhotoUrls[0] ?? null;
    patch.photo_urls = normalizedPhotoUrls;
  }

  let rows: RoomRow[];

  try {
    rows = await supabaseDbRequest<RoomRow[]>(
      `rooms?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify(patch),
      },
    );
  } catch (error) {
    if (!shouldPatchPhotos || !isPhotoUrlsColumnError(error)) throw error;

    const fallbackPatch = { ...patch };
    delete fallbackPatch.photo_urls;
    fallbackPatch.photo_url = serializeRoomPhotoUrlLegacy(normalizedPhotoUrls);

    rows = await supabaseDbRequest<RoomRow[]>(
      `rooms?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify(fallbackPatch),
      },
    );
  }

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
