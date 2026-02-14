import type { Room } from '@/types';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const sanitizePhotoUrls = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const cleaned = value.filter(isNonEmptyString).map((photo) => photo.trim());
  return Array.from(new Set(cleaned));
};

export const parseLegacyPhotoUrl = (photoUrl: string | null | undefined): string[] => {
  if (!isNonEmptyString(photoUrl)) return [];

  const value = photoUrl.trim();
  if (!value.startsWith('[')) return [value];

  try {
    return sanitizePhotoUrls(JSON.parse(value) as unknown);
  } catch {
    return [value];
  }
};

export const normalizeRoomPhotoUrls = (
  photoUrls: unknown,
  legacyPhotoUrl: string | null | undefined,
): string[] => {
  const normalized = sanitizePhotoUrls(photoUrls);
  if (normalized.length > 0) return normalized;
  return parseLegacyPhotoUrl(legacyPhotoUrl);
};

export const serializeRoomPhotoUrlLegacy = (photoUrls: string[]) => {
  if (photoUrls.length === 0) return null;
  if (photoUrls.length === 1) return photoUrls[0];
  return JSON.stringify(photoUrls);
};

export const getRoomPhotoUrls = (room: Pick<Room, 'photoUrl' | 'photoUrls'>): string[] =>
  normalizeRoomPhotoUrls(room.photoUrls, room.photoUrl);
