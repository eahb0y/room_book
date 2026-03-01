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
  description?: string | null;
  location?: string | null;
  access_type?: 'public' | 'residents_only' | null;
  available_from?: string | null;
  available_to?: string | null;
  min_booking_minutes?: number | null;
  max_booking_minutes?: number | null;
  capacity: number;
  services?: string[] | null;
  photo_url: string | null;
  photo_urls?: string[] | null;
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
    || message.includes('pgrst204')
    || message.includes('42703')
  );
};

const extractMissingColumnName = (error: unknown) => {
  const message = getErrorMessage(error);
  if (!message) return null;

  const schemaCacheMatch = message.match(/could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i);
  if (schemaCacheMatch?.[1]) {
    return schemaCacheMatch[1].toLowerCase();
  }

  const doesNotExistMatch = message.match(/column\s+["']?([a-zA-Z0-9_.]+)["']?\s+does not exist/i);
  if (doesNotExistMatch?.[1]) {
    const normalized = doesNotExistMatch[1].replace(/"/g, '');
    const column = normalized.split('.').pop();
    return column ? column.toLowerCase() : null;
  }

  return null;
};

const isPhotoUrlsColumnError = (error: unknown) => {
  return isMissingColumnError(error, 'photo_urls');
};

const isAccessTypeColumnError = (error: unknown) => {
  return isMissingColumnError(error, 'access_type');
};

const MAX_SCHEMA_FALLBACK_ATTEMPTS = 20;

const normalizeRoomTime = (value: string | null | undefined, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  if (trimmed === '24:00' || trimmed.startsWith('24:00')) return '24:00';

  const match = trimmed.match(/^(\d{2}):(\d{2})/);
  if (!match) return fallback;
  return `${match[1]}:${match[2]}`;
};

const coercePositiveMinutes = (value: number | null | undefined, fallback: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  if (rounded < 1) return fallback;
  return rounded;
};

const mapRoom = (row: RoomRow): Room => {
  const photoUrls = normalizeRoomPhotoUrls(row.photo_urls, row.photo_url);
  const availableFrom = normalizeRoomTime(row.available_from, '00:00');
  const availableTo = normalizeRoomTime(row.available_to, '24:00');
  const minBookingMinutes = coercePositiveMinutes(row.min_booking_minutes, 15);
  const maxBookingMinutes = Math.max(
    minBookingMinutes,
    coercePositiveMinutes(row.max_booking_minutes, 240),
  );

  return {
    id: row.id,
    venueId: row.venue_id,
    name: row.name,
    description: row.description ?? '',
    location: row.location ?? '',
    accessType: row.access_type === 'residents_only' ? 'residents_only' : 'public',
    availableFrom,
    availableTo,
    minBookingMinutes,
    maxBookingMinutes,
    capacity: row.capacity,
    services: Array.isArray(row.services) ? row.services.filter((value): value is string => typeof value === 'string') : [],
    photoUrl: photoUrls[0] ?? null,
    photoUrls,
    createdAt: row.created_at,
  };
};

const toInFilter = (values: string[]) => values.join(',');

const ROOM_MUTABLE_COLUMNS = [
  'description',
  'location',
  'services',
  'available_from',
  'available_to',
  'min_booking_minutes',
  'max_booking_minutes',
  'photo_url',
  'photo_urls',
  'access_type',
] as const;

const ROOM_MUTABLE_COLUMNS_SET = new Set<string>(ROOM_MUTABLE_COLUMNS);

const getMissingRoomColumn = (error: unknown) => {
  const extracted = extractMissingColumnName(error);
  if (extracted) return extracted;

  for (const column of ROOM_MUTABLE_COLUMNS) {
    if (isMissingColumnError(error, column)) return column;
  }

  return null;
};

const removeColumnFromPayload = (payload: Record<string, unknown>, column: string) => {
  if (!ROOM_MUTABLE_COLUMNS_SET.has(column)) return false;
  if (!Object.prototype.hasOwnProperty.call(payload, column)) return false;
  delete payload[column];
  return true;
};

const fetchRoomById = async (id: string) => {
  const rows = await supabaseDbRequest<RoomRow[]>(
    `rooms?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
    { method: 'GET' },
  );
  const room = rows[0];
  if (!room) throw new Error('Комната не найдена');
  return mapRoom(room);
};

export const listRooms = async (params?: { venueId?: string; venueIds?: string[]; publicAccess?: boolean }) => {
  if (params?.venueId) {
    const rows = await supabaseDbRequest<RoomRow[]>(
      `rooms?select=*&venue_id=eq.${encodeURIComponent(params.venueId)}&order=created_at.desc`,
      { method: 'GET' },
      { requireAuth: !params.publicAccess },
    );

    return rows.map(mapRoom);
  }

  if (params?.venueIds && params.venueIds.length > 0) {
    const rows = await supabaseDbRequest<RoomRow[]>(
      `rooms?select=*&venue_id=in.(${toInFilter(params.venueIds)})&order=created_at.desc`,
      { method: 'GET' },
      { requireAuth: !params.publicAccess },
    );

    return rows.map(mapRoom);
  }

  const rows = await supabaseDbRequest<RoomRow[]>(
    'rooms?select=*&order=created_at.desc',
    { method: 'GET' },
    { requireAuth: !params?.publicAccess },
  );
  return rows.map(mapRoom);
};

export const createRoom = async (payload: {
  venueId: string;
  name: string;
  description: string;
  location: string;
  accessType: Room['accessType'];
  availableFrom: string;
  availableTo: string;
  minBookingMinutes: number;
  maxBookingMinutes: number;
  capacity: number;
  services: string[];
  photoUrls?: string[] | null;
  photoUrl?: string | null;
}) => {
  const photoUrls = normalizeRoomPhotoUrls(payload.photoUrls, payload.photoUrl ?? null);
  const wantsResidentsOnly = payload.accessType === 'residents_only';
  const insertPayload: Record<string, unknown> = {
    venue_id: payload.venueId,
    name: payload.name,
    description: payload.description,
    location: payload.location,
    access_type: payload.accessType,
    available_from: payload.availableFrom,
    available_to: payload.availableTo,
    min_booking_minutes: payload.minBookingMinutes,
    max_booking_minutes: payload.maxBookingMinutes,
    capacity: payload.capacity,
    services: payload.services,
    photo_url: photoUrls[0] ?? null,
    photo_urls: photoUrls,
  };

  if (!wantsResidentsOnly) {
    delete insertPayload.access_type;
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_SCHEMA_FALLBACK_ATTEMPTS; attempt += 1) {
    try {
      const rows = await supabaseDbRequest<RoomRow[]>(
        'rooms',
        {
          method: 'POST',
          headers: {
            Prefer: 'return=representation',
          },
          body: JSON.stringify([insertPayload]),
        },
      );

      const created = rows[0];
      if (!created) throw new Error('Не удалось создать комнату');
      return mapRoom(created);
    } catch (error) {
      const missingColumn = getMissingRoomColumn(error);

      if (missingColumn && removeColumnFromPayload(insertPayload, missingColumn)) {
        if (missingColumn === 'photo_urls' && Object.prototype.hasOwnProperty.call(insertPayload, 'photo_url')) {
          insertPayload.photo_url = serializeRoomPhotoUrlLegacy(photoUrls);
        }
        lastError = error;
        continue;
      }

      if (isPhotoUrlsColumnError(error) && removeColumnFromPayload(insertPayload, 'photo_urls')) {
        if (Object.prototype.hasOwnProperty.call(insertPayload, 'photo_url')) {
          insertPayload.photo_url = serializeRoomPhotoUrlLegacy(photoUrls);
        }
        lastError = error;
        continue;
      }

      if (isAccessTypeColumnError(error)) {
        if (removeColumnFromPayload(insertPayload, 'access_type')) {
          lastError = error;
          continue;
        }
      }

      throw error;
    }
  }

  throw (lastError instanceof Error ? lastError : new Error('Не удалось создать комнату'));
};

export const updateRoom = async (
  id: string,
  payload: Partial<
    Pick<
      Room,
      | 'name'
      | 'description'
      | 'location'
      | 'accessType'
      | 'availableFrom'
      | 'availableTo'
      | 'minBookingMinutes'
      | 'maxBookingMinutes'
      | 'capacity'
      | 'services'
      | 'photoUrl'
      | 'photoUrls'
    >
  >,
) => {
  const shouldPatchPhotos = payload.photoUrls !== undefined || payload.photoUrl !== undefined;
  const shouldPatchAccessType = payload.accessType !== undefined;
  const normalizedPhotoUrls = shouldPatchPhotos
    ? normalizeRoomPhotoUrls(payload.photoUrls, payload.photoUrl)
    : [];
  const patch: Record<string, unknown> = {};
  if (payload.name !== undefined) patch.name = payload.name;
  if (payload.description !== undefined) patch.description = payload.description;
  if (payload.location !== undefined) patch.location = payload.location;
  if (payload.availableFrom !== undefined) patch.available_from = payload.availableFrom;
  if (payload.availableTo !== undefined) patch.available_to = payload.availableTo;
  if (payload.minBookingMinutes !== undefined) patch.min_booking_minutes = payload.minBookingMinutes;
  if (payload.maxBookingMinutes !== undefined) patch.max_booking_minutes = payload.maxBookingMinutes;
  if (payload.capacity !== undefined) patch.capacity = payload.capacity;
  if (payload.services !== undefined) patch.services = payload.services;
  if (shouldPatchAccessType) patch.access_type = payload.accessType;
  if (shouldPatchPhotos) {
    patch.photo_url = normalizedPhotoUrls[0] ?? null;
    patch.photo_urls = normalizedPhotoUrls;
  }

  if (Object.keys(patch).length === 0) {
    return fetchRoomById(id);
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_SCHEMA_FALLBACK_ATTEMPTS; attempt += 1) {
    try {
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
      if (!updated) throw new Error('Комната не найдена');
      return mapRoom(updated);
    } catch (error) {
      const missingColumn = getMissingRoomColumn(error);

      if (missingColumn && removeColumnFromPayload(patch, missingColumn)) {
        if (missingColumn === 'photo_urls' && Object.prototype.hasOwnProperty.call(patch, 'photo_url')) {
          patch.photo_url = serializeRoomPhotoUrlLegacy(normalizedPhotoUrls);
        }
        if (Object.keys(patch).length === 0) {
          return fetchRoomById(id);
        }
        lastError = error;
        continue;
      }

      if (isPhotoUrlsColumnError(error) && removeColumnFromPayload(patch, 'photo_urls')) {
        if (Object.prototype.hasOwnProperty.call(patch, 'photo_url')) {
          patch.photo_url = serializeRoomPhotoUrlLegacy(normalizedPhotoUrls);
        }
        if (Object.keys(patch).length === 0) {
          return fetchRoomById(id);
        }
        lastError = error;
        continue;
      }

      if (isAccessTypeColumnError(error)) {
        if (removeColumnFromPayload(patch, 'access_type')) {
          if (Object.keys(patch).length === 0) {
            return fetchRoomById(id);
          }
          lastError = error;
          continue;
        }
      }

      throw error;
    }
  }

  throw (lastError instanceof Error ? lastError : new Error('Комната не найдена'));
};

export const deleteRoom = async (id: string) => {
  await supabaseDbRequest<unknown>(`rooms?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      Prefer: 'return=minimal',
    },
  });
};
