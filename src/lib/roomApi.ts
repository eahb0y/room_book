import type { Room } from '@/types';
import { request } from '@/lib/apiClient';

export const listRooms = async (params?: { venueId?: string; venueIds?: string[] }) => {
  const search = new URLSearchParams();
  if (params?.venueId) search.set('venueId', params.venueId);
  if (params?.venueIds && params.venueIds.length > 0) {
    search.set('venueIds', params.venueIds.join(','));
  }
  const suffix = search.toString() ? `?${search.toString()}` : '';
  const data = await request<{ rooms: Room[] }>(`/api/rooms${suffix}`);
  return data.rooms;
};

export const createRoom = async (payload: { venueId: string; name: string; capacity: number }) => {
  const data = await request<{ room: Room }>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.room;
};

export const updateRoom = async (id: string, payload: Partial<Pick<Room, 'name' | 'capacity'>>) => {
  const data = await request<{ room: Room }>(`/api/rooms/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return data.room;
};

export const deleteRoom = async (id: string) => {
  await request<{ success: boolean }>(`/api/rooms/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
};
