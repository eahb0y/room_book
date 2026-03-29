import type {
  AvailableVenueTable,
  VenueFloorPlan,
  VenueTable,
  VenueTableBooking,
  VenueTableShape,
} from '@/types';
import {
  getSupabaseStoragePublicUrl,
  supabaseDbRequest,
  supabaseStorageRequest,
} from '@/lib/supabaseHttp';

export const FLOOR_PLAN_STORAGE_BUCKET = 'venue-floor-plans';
export const FLOOR_PLAN_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const FLOOR_PLAN_ALLOWED_TYPES = ['image/jpeg', 'image/png'] as const;
export const DEFAULT_TABLE_BOOKING_DURATION_MINUTES = 120;

interface VenueTableRow {
  id: string;
  floor_plan_id: string;
  table_number: string;
  capacity: number;
  x_position: number | string;
  y_position: number | string;
  width: number | string;
  height: number | string;
  shape: VenueTableShape;
  notes?: string | null;
  is_active?: boolean | null;
  created_at: string;
  updated_at?: string | null;
}

interface VenueFloorPlanRow {
  id: string;
  venue_id: string;
  name: string;
  image_path: string;
  width: number;
  height: number;
  created_at: string;
  updated_at?: string | null;
  venue_tables?: VenueTableRow[] | null;
}

interface AvailableVenueTableRow {
  floor_plan_id: string;
  floor_plan_name: string;
  floor_plan_image_path: string;
  floor_plan_width: number;
  floor_plan_height: number;
  table_id: string;
  table_number: string;
  capacity: number;
  x_position: number | string;
  y_position: number | string;
  table_width: number | string;
  table_height: number | string;
  shape: VenueTableShape;
  notes?: string | null;
  is_available: boolean;
  is_capacity_match: boolean;
}

interface VenueTableBookingRow {
  id: string;
  venue_table_id: string;
  user_id: string;
  guest_count: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  notes?: string | null;
  status: 'active' | 'cancelled';
  created_at: string;
  updated_at?: string | null;
}

const toInFilter = (values: string[]) => values.join(',');

const toNumber = (value: number | string) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeTime = (value: string) => value.slice(0, 5);

const sortTables = (tables: VenueTable[]) =>
  [...tables].sort((left, right) => left.tableNumber.localeCompare(right.tableNumber, 'ru-RU', { numeric: true }));

const mapVenueTable = (row: VenueTableRow): VenueTable => ({
  id: row.id,
  floorPlanId: row.floor_plan_id,
  tableNumber: row.table_number,
  capacity: row.capacity,
  xPosition: toNumber(row.x_position),
  yPosition: toNumber(row.y_position),
  width: toNumber(row.width),
  height: toNumber(row.height),
  shape: row.shape,
  notes: row.notes ?? '',
  isActive: row.is_active ?? true,
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? row.created_at,
});

const mapVenueFloorPlan = (row: VenueFloorPlanRow): VenueFloorPlan => ({
  id: row.id,
  venueId: row.venue_id,
  name: row.name,
  imagePath: row.image_path,
  width: row.width,
  height: row.height,
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? row.created_at,
  tables: sortTables((row.venue_tables ?? []).map(mapVenueTable)),
});

const mapAvailableVenueTable = (row: AvailableVenueTableRow): AvailableVenueTable => ({
  id: row.table_id,
  floorPlanId: row.floor_plan_id,
  tableNumber: row.table_number,
  capacity: row.capacity,
  xPosition: toNumber(row.x_position),
  yPosition: toNumber(row.y_position),
  width: toNumber(row.table_width),
  height: toNumber(row.table_height),
  shape: row.shape,
  notes: row.notes ?? '',
  isActive: true,
  createdAt: '',
  updatedAt: '',
  floorPlanName: row.floor_plan_name,
  floorPlanImagePath: row.floor_plan_image_path,
  floorPlanWidth: row.floor_plan_width,
  floorPlanHeight: row.floor_plan_height,
  isAvailable: row.is_available,
  isCapacityMatch: row.is_capacity_match,
});

const mapVenueTableBooking = (row: VenueTableBookingRow): VenueTableBooking => ({
  id: row.id,
  venueTableId: row.venue_table_id,
  userId: row.user_id,
  guestCount: row.guest_count,
  bookingDate: row.booking_date,
  startTime: normalizeTime(row.start_time),
  endTime: normalizeTime(row.end_time),
  notes: row.notes ?? '',
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? row.created_at,
});

const sanitizeFileName = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'floor-plan';
};

const getFileExtension = (file: File) => {
  if (file.type === 'image/png') return 'png';
  return 'jpg';
};

const getFloorPlanUploadPath = (venueId: string, file: File) => {
  const timestamp = Date.now();
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

  return `${venueId}/floor-plans/${sanitizeFileName(file.name)}-${timestamp}-${random}.${getFileExtension(file)}`;
};

export const validateFloorPlanImageFile = (file: File) => {
  if (!FLOOR_PLAN_ALLOWED_TYPES.includes(file.type as (typeof FLOOR_PLAN_ALLOWED_TYPES)[number])) {
    throw new Error('Поддерживаются только JPG и PNG изображения');
  }

  if (file.size > FLOOR_PLAN_MAX_FILE_BYTES) {
    throw new Error('Размер изображения не должен превышать 5MB');
  }
};

export const readFloorPlanImageSize = (file: File) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
      URL.revokeObjectURL(objectUrl);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Не удалось определить размеры изображения'));
    };

    image.src = objectUrl;
  });

export const listVenueFloorPlans = async (params?: {
  venueId?: string;
  venueIds?: string[];
  publicAccess?: boolean;
}) => {
  const filters = ['select=*,venue_tables(*)', 'order=created_at.asc'];

  if (params?.venueId) {
    filters.push(`venue_id=eq.${encodeURIComponent(params.venueId)}`);
  } else if (params?.venueIds && params.venueIds.length > 0) {
    filters.push(`venue_id=in.(${toInFilter(params.venueIds)})`);
  }

  const rows = await supabaseDbRequest<VenueFloorPlanRow[]>(
    `venue_floor_plans?${filters.join('&')}`,
    { method: 'GET' },
    { requireAuth: !params?.publicAccess },
  );

  return rows.map(mapVenueFloorPlan);
};

export const uploadVenueFloorPlan = async (payload: {
  venueId: string;
  name: string;
  file: File;
}) => {
  validateFloorPlanImageFile(payload.file);
  const imageSize = await readFloorPlanImageSize(payload.file);
  const uploadPath = getFloorPlanUploadPath(payload.venueId, payload.file);

  await supabaseStorageRequest(
    `object/${FLOOR_PLAN_STORAGE_BUCKET}/${uploadPath}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': payload.file.type,
        'x-upsert': 'false',
      },
      body: payload.file,
    },
  );

  const imagePath = getSupabaseStoragePublicUrl(FLOOR_PLAN_STORAGE_BUCKET, uploadPath);
  const rows = await supabaseDbRequest<VenueFloorPlanRow[]>(
    'venue_floor_plans?select=*,venue_tables(*)',
    {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify([{
        venue_id: payload.venueId,
        name: payload.name.trim(),
        image_path: imagePath,
        width: imageSize.width,
        height: imageSize.height,
      }]),
    },
  );

  const created = rows[0];
  if (!created) throw new Error('Не удалось создать план заведения');
  return mapVenueFloorPlan(created);
};

export const updateVenueFloorPlan = async (
  id: string,
  payload: Partial<Pick<VenueFloorPlan, 'name' | 'imagePath' | 'width' | 'height'>>,
) => {
  const patch: Record<string, unknown> = {};
  if (payload.name !== undefined) patch.name = payload.name;
  if (payload.imagePath !== undefined) patch.image_path = payload.imagePath;
  if (payload.width !== undefined) patch.width = payload.width;
  if (payload.height !== undefined) patch.height = payload.height;

  const rows = await supabaseDbRequest<VenueFloorPlanRow[]>(
    `venue_floor_plans?id=eq.${encodeURIComponent(id)}&select=*,venue_tables(*)`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify(patch),
    },
  );

  const updated = rows[0];
  if (!updated) throw new Error('План заведения не найден');
  return mapVenueFloorPlan(updated);
};

export const createVenueTable = async (payload: {
  id?: string;
  floorPlanId: string;
  tableNumber: string;
  capacity: number;
  xPosition: number;
  yPosition: number;
  width: number;
  height: number;
  shape: VenueTableShape;
  notes?: string;
  isActive?: boolean;
}) => {
  const insertPayload: Record<string, unknown> = {
    floor_plan_id: payload.floorPlanId,
    table_number: payload.tableNumber.trim(),
    capacity: payload.capacity,
    x_position: payload.xPosition,
    y_position: payload.yPosition,
    width: payload.width,
    height: payload.height,
    shape: payload.shape,
    notes: payload.notes ?? '',
    is_active: payload.isActive ?? true,
  };

  if (payload.id) {
    insertPayload.id = payload.id;
  }

  const rows = await supabaseDbRequest<VenueTableRow[]>(
    'venue_tables?select=*',
    {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify([insertPayload]),
    },
  );

  const created = rows[0];
  if (!created) throw new Error('Не удалось создать стол');
  return mapVenueTable(created);
};

export const updateVenueTable = async (
  id: string,
  payload: Partial<Pick<VenueTable, 'tableNumber' | 'capacity' | 'xPosition' | 'yPosition' | 'width' | 'height' | 'shape' | 'notes' | 'isActive'>>,
) => {
  const patch: Record<string, unknown> = {};
  if (payload.tableNumber !== undefined) patch.table_number = payload.tableNumber.trim();
  if (payload.capacity !== undefined) patch.capacity = payload.capacity;
  if (payload.xPosition !== undefined) patch.x_position = payload.xPosition;
  if (payload.yPosition !== undefined) patch.y_position = payload.yPosition;
  if (payload.width !== undefined) patch.width = payload.width;
  if (payload.height !== undefined) patch.height = payload.height;
  if (payload.shape !== undefined) patch.shape = payload.shape;
  if (payload.notes !== undefined) patch.notes = payload.notes;
  if (payload.isActive !== undefined) patch.is_active = payload.isActive;

  const rows = await supabaseDbRequest<VenueTableRow[]>(
    `venue_tables?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify(patch),
    },
  );

  const updated = rows[0];
  if (!updated) throw new Error('Стол не найден');
  return mapVenueTable(updated);
};

export const deleteVenueTable = async (id: string) => {
  await supabaseDbRequest<unknown>(
    `venue_tables?id=eq.${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
};

export const listAvailableVenueTables = async (params: {
  venueId: string;
  bookingDate: string;
  startTime: string;
  guests: number;
  durationMinutes?: number;
  publicAccess?: boolean;
}) => {
  const rows = await supabaseDbRequest<AvailableVenueTableRow[]>(
    'rpc/list_available_venue_tables',
    {
      method: 'POST',
      body: JSON.stringify({
        p_venue_id: params.venueId,
        p_booking_date: params.bookingDate,
        p_start_time: params.startTime,
        p_guests: params.guests,
        p_duration_minutes: params.durationMinutes ?? DEFAULT_TABLE_BOOKING_DURATION_MINUTES,
      }),
    },
    { requireAuth: !params.publicAccess },
  );

  return rows.map(mapAvailableVenueTable);
};

export const createVenueTableBooking = async (payload: {
  venueTableId: string;
  userId: string;
  guestCount: number;
  bookingDate: string;
  startTime: string;
  endTime: string;
  notes?: string;
}) => {
  const rows = await supabaseDbRequest<VenueTableBookingRow[]>(
    'venue_table_bookings?select=*',
    {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify([{
        venue_table_id: payload.venueTableId,
        user_id: payload.userId,
        guest_count: payload.guestCount,
        booking_date: payload.bookingDate,
        start_time: payload.startTime,
        end_time: payload.endTime,
        notes: payload.notes ?? '',
      }]),
    },
  );

  const created = rows[0];
  if (!created) throw new Error('Не удалось создать бронь стола');
  return mapVenueTableBooking(created);
};
