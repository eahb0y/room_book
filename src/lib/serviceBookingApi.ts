import type { BusinessServiceProvider, ServiceBooking } from '@/types';
import { debugError, debugInfo, debugWarn } from '@/lib/frontendDebug';
import { getBusinessServiceById } from '@/lib/serviceApi';
import { supabaseDbRequest } from '@/lib/supabaseHttp';

interface ServiceBookingRow {
  id: string;
  service_id: string;
  user_id: string;
  provider_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: 'active' | 'cancelled';
  created_at: string;
}

interface BookingProfileRow {
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface ServiceRow {
  name: string;
  venue_id: string;
  providers: unknown;
  photo_url: string | null;
}

type ServiceBookingRowWithDetails = ServiceBookingRow & {
  booker?: BookingProfileRow | BookingProfileRow[] | null;
  service?: ServiceRow | ServiceRow[] | null;
};

interface ServiceBookingBusySlotRow {
  start_time: string;
  end_time: string;
}

export interface ServiceBookingBusySlot {
  startTime: string;
  endTime: string;
}

const MINUTES_IN_DAY = 24 * 60;
let serviceBookingsTableMissing = false;
let busySlotsRpcMissing = false;
const serviceBookingSelectWithDetails = [
  '*',
  'booker:profiles!service_bookings_user_id_fkey(email,first_name,last_name)',
  'service:business_services!inner(name,venue_id,providers,photo_url)',
].join(',');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const normalizeProvider = (value: unknown): BusinessServiceProvider | null => {
  if (!isRecord(value)) return null;

  const id = typeof value.id === 'string'
    ? value.id
    : typeof value.staffId === 'string'
      ? value.staffId
      : typeof value.staff_id === 'string'
        ? value.staff_id
        : typeof value.userId === 'string'
          ? value.userId
          : typeof value.user_id === 'string'
            ? value.user_id
            : '';
  const name = typeof value.name === 'string'
    ? value.name
    : typeof value.userName === 'string'
      ? value.userName
      : typeof value.user_name === 'string'
        ? value.user_name
        : '';
  const location = typeof value.location === 'string' ? value.location : '';
  const workFrom = typeof value.workFrom === 'string'
    ? value.workFrom
    : typeof value.work_from === 'string'
      ? value.work_from
      : null;
  const workTo = typeof value.workTo === 'string'
    ? value.workTo
    : typeof value.work_to === 'string'
      ? value.work_to
      : null;
  const durationMinutes = normalizeNumber(
    typeof value.durationMinutes !== 'undefined'
      ? value.durationMinutes
      : typeof value.duration_minutes !== 'undefined'
        ? value.duration_minutes
        : 0,
  );
  const price = normalizeNumber(value.price);
  const photoUrl = typeof value.photoUrl === 'string'
    ? value.photoUrl
    : typeof value.photo_url === 'string'
      ? value.photo_url
      : null;

  const normalizedId = id.trim();
  const normalizedName = name.trim();
  if (!normalizedId || !normalizedName) return null;

  return {
    id: normalizedId,
    name: normalizedName,
    location: location.trim(),
    workFrom: workFrom?.trim() || null,
    workTo: workTo?.trim() || null,
    durationMinutes: Math.max(0, Math.round(durationMinutes)),
    price: Math.max(0, price),
    photoUrl: photoUrl?.trim() || null,
  };
};

const normalizeProviders = (value: unknown): BusinessServiceProvider[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map(normalizeProvider)
    .filter((provider): provider is BusinessServiceProvider => provider !== null);
};

const resolveJoinedRecord = <T>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const toMinutes = (time: string) => {
  if (time === '24:00') return MINUTES_IN_DAY;

  const [hour, minute] = time.split(':');
  return parseInt(hour, 10) * 60 + parseInt(minute, 10);
};

const toTime = (totalMinutes: number) => {
  if (totalMinutes >= MINUTES_IN_DAY) return '24:00';

  const safeMinutes = Math.max(0, totalMinutes);
  const hour = Math.floor(safeMinutes / 60).toString().padStart(2, '0');
  const minute = (safeMinutes % 60).toString().padStart(2, '0');
  return `${hour}:${minute}`;
};

const isOverlapping = (startA: string, endA: string, startB: string, endB: string) =>
  startA < endB && endA > startB;

const isPastBookingStart = (bookingDate: string, startTime: string) => {
  const startAt = new Date(`${bookingDate}T${startTime}:00`);
  if (Number.isNaN(startAt.getTime())) return false;
  return startAt.getTime() < Date.now();
};

const normalizeServiceBookingError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return new Error('Не удалось выполнить бронирование услуги');
  }

  const message = error.message.toLowerCase();
  if (
    message.includes('service_bookings_no_overlap')
    || message.includes('conflicting key value violates exclusion constraint')
    || message.includes('already occupied')
  ) {
    return new Error('Этот слот уже занят');
  }

  if (
    message.includes("could not find the table 'public.service_bookings'")
    || message.includes('relation "service_bookings" does not exist')
    || message.includes('list_service_booking_busy_slots')
  ) {
    return new Error('Бронирование услуг временно недоступно');
  }

  return error;
};

const isMissingBusySlotsRpcError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();

  return (
    (message.includes('could not find the function')
      && message.includes('list_service_booking_busy_slots'))
    || (message.includes('pgrst202') && message.includes('list_service_booking_busy_slots'))
    || message.includes("could not find the table 'public.service_bookings'")
    || message.includes('relation "service_bookings" does not exist')
  );
};

const isMissingServiceBookingsTableError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();

  return (
    message.includes("could not find the table 'public.service_bookings'")
    || message.includes('relation "service_bookings" does not exist')
    || (message.includes('pgrst') && message.includes('service_bookings'))
  );
};

const mapServiceBooking = (row: ServiceBookingRowWithDetails): ServiceBooking => {
  const booker = resolveJoinedRecord(row.booker);
  const service = resolveJoinedRecord(row.service);
  const providers = normalizeProviders(service?.providers);
  const provider = providers.find((item) => item.id === row.provider_id);

  return {
    id: row.id,
    serviceId: row.service_id,
    venueId: service?.venue_id,
    providerId: row.provider_id,
    providerName: provider?.name,
    serviceName: service?.name,
    servicePhotoUrl: service?.photo_url ?? null,
    userId: row.user_id,
    userEmail: booker?.email ?? undefined,
    userFirstName: booker?.first_name ?? undefined,
    userLastName: booker?.last_name ?? undefined,
    bookingDate: row.booking_date,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    status: row.status,
    createdAt: row.created_at,
  };
};

const buildServiceBookingMutationPayload = (payload: {
  serviceId: string;
  providerId: string;
  userId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status?: 'active' | 'cancelled';
}) => ({
  service_id: payload.serviceId,
  provider_id: payload.providerId,
  user_id: payload.userId,
  booking_date: payload.bookingDate,
  start_time: payload.startTime,
  end_time: payload.endTime,
  status: payload.status ?? 'active',
});

export const listServiceBookings = async (params?: {
  userId?: string;
  venueId?: string;
  serviceId?: string;
  providerId?: string;
}) => {
  if (serviceBookingsTableMissing) return [];

  try {
    const filters = [`select=${serviceBookingSelectWithDetails}`, 'order=created_at.desc'];

    if (params?.userId) filters.push(`user_id=eq.${encodeURIComponent(params.userId)}`);
    if (params?.serviceId) filters.push(`service_id=eq.${encodeURIComponent(params.serviceId)}`);
    if (params?.providerId) filters.push(`provider_id=eq.${encodeURIComponent(params.providerId)}`);
    if (params?.venueId) filters.push(`service.venue_id=eq.${encodeURIComponent(params.venueId)}`);

    const rows = await supabaseDbRequest<ServiceBookingRowWithDetails[]>(
      `service_bookings?${filters.join('&')}`,
      { method: 'GET' },
    );

    return rows.map(mapServiceBooking);
  } catch (error) {
    if (isMissingServiceBookingsTableError(error)) {
      serviceBookingsTableMissing = true;
      debugWarn('service-booking.list.table-missing', {
        userId: params?.userId,
        venueId: params?.venueId,
        serviceId: params?.serviceId,
        providerId: params?.providerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }

    throw error;
  }
};

export const listServiceBookingBusySlots = async (params: {
  serviceId: string;
  providerId: string;
  bookingDate: string;
}) => {
  if (busySlotsRpcMissing || serviceBookingsTableMissing) return [];

  try {
    const rows = await supabaseDbRequest<ServiceBookingBusySlotRow[]>(
      'rpc/list_service_booking_busy_slots',
      {
        method: 'POST',
        body: JSON.stringify({
          p_service_id: params.serviceId,
          p_provider_id: params.providerId,
          p_booking_date: params.bookingDate,
        }),
      },
      { requireAuth: false },
    );

    return rows.map((row) => ({
      startTime: row.start_time.slice(0, 5),
      endTime: row.end_time.slice(0, 5),
    }));
  } catch (error) {
    if (isMissingBusySlotsRpcError(error)) {
      busySlotsRpcMissing = true;
      if (isMissingServiceBookingsTableError(error)) {
        serviceBookingsTableMissing = true;
      }
      debugWarn('service-booking.busy-slots.rpc-missing', {
        serviceId: params.serviceId,
        providerId: params.providerId,
        bookingDate: params.bookingDate,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }

    throw error;
  }
};

export const createServiceBooking = async (payload: {
  serviceId: string;
  providerId: string;
  userId: string;
  bookingDate: string;
  startTime: string;
}) => {
  debugInfo('service-booking.create.request.started', {
    serviceId: payload.serviceId,
    providerId: payload.providerId,
    userId: payload.userId,
    bookingDate: payload.bookingDate,
    startTime: payload.startTime,
  });

  try {
    if (isPastBookingStart(payload.bookingDate, payload.startTime)) {
      throw new Error('Нельзя бронировать прошедшее время');
    }

    const service = await getBusinessServiceById(payload.serviceId, { publicAccess: true });
    const provider = service.providers.find((item) => item.id === payload.providerId);

    if (!provider) {
      throw new Error('Специалист не найден');
    }

    if (provider.durationMinutes <= 0) {
      throw new Error('Для этой услуги не задана длительность');
    }

    const availabilityStart = provider.workFrom?.trim() || '00:00';
    const availabilityEnd = provider.workTo?.trim() || '24:00';
    const startMinutes = toMinutes(payload.startTime);
    const endTime = toTime(startMinutes + provider.durationMinutes);
    const endMinutes = toMinutes(endTime);

    if (startMinutes >= endMinutes) {
      throw new Error('Время окончания должно быть позже времени начала');
    }

    if (startMinutes < toMinutes(availabilityStart) || endMinutes > toMinutes(availabilityEnd)) {
      throw new Error(`Услуга доступна только с ${availabilityStart} до ${availabilityEnd}`);
    }

    const busySlots = await listServiceBookingBusySlots({
      serviceId: payload.serviceId,
      providerId: payload.providerId,
      bookingDate: payload.bookingDate,
    });

    const hasOverlap = busySlots.some((slot) =>
      isOverlapping(payload.startTime, endTime, slot.startTime, slot.endTime),
    );

    if (hasOverlap) {
      throw new Error('Этот слот уже занят');
    }

    const rows = await supabaseDbRequest<ServiceBookingRowWithDetails[]>(
      `service_bookings?select=${serviceBookingSelectWithDetails}`,
      {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify([
          buildServiceBookingMutationPayload({
            ...payload,
            endTime,
          }),
        ]),
      },
    );

    const created = rows[0];
    if (!created) throw new Error('Не удалось создать бронирование услуги');

    debugInfo('service-booking.create.request.succeeded', {
      bookingId: created.id,
      serviceId: created.service_id,
      providerId: created.provider_id,
      userId: created.user_id,
      bookingDate: created.booking_date,
      startTime: created.start_time,
      endTime: created.end_time,
    });

    return mapServiceBooking(created);
  } catch (error) {
    const normalizedError = normalizeServiceBookingError(error);

    debugError('service-booking.create.request.failed', {
      serviceId: payload.serviceId,
      providerId: payload.providerId,
      userId: payload.userId,
      bookingDate: payload.bookingDate,
      startTime: payload.startTime,
      error: normalizedError.message,
    });

    throw normalizedError;
  }
};

export const cancelServiceBooking = async (id: string) => {
  debugInfo('service-booking.cancel.request.started', {
    bookingId: id,
  });

  const rows = await supabaseDbRequest<ServiceBookingRowWithDetails[]>(
    `service_bookings?id=eq.${encodeURIComponent(id)}&select=${serviceBookingSelectWithDetails}`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        status: 'cancelled',
      }),
    },
  );

  const updated = rows[0];
  if (!updated) throw new Error('Бронирование услуги не найдено');

  debugInfo('service-booking.cancel.request.succeeded', {
    bookingId: updated.id,
    serviceId: updated.service_id,
    providerId: updated.provider_id,
    status: updated.status,
  });

  return mapServiceBooking(updated);
};
