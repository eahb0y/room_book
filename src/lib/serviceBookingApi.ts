import type { ServiceBooking } from '@/types';
import { debugError, debugInfo } from '@/lib/frontendDebug';
import { backendRequest } from '@/lib/backendHttp';
import { getBusinessServiceById } from '@/lib/serviceApi';

export interface ServiceBookingBusySlot {
  startTime: string;
  endTime: string;
}

const MINUTES_IN_DAY = 24 * 60;

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

const buildQuery = (params?: {
  userId?: string;
  venueId?: string;
  serviceId?: string;
  providerId?: string;
}) => {
  const searchParams = new URLSearchParams();
  if (params?.userId) searchParams.set('userId', params.userId);
  if (params?.venueId) searchParams.set('venueId', params.venueId);
  if (params?.serviceId) searchParams.set('serviceId', params.serviceId);
  if (params?.providerId) searchParams.set('providerId', params.providerId);
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const listServiceBookings = async (params?: {
  userId?: string;
  venueId?: string;
  serviceId?: string;
  providerId?: string;
}) => {
  return backendRequest<ServiceBooking[]>(
    `/api/service-bookings${buildQuery(params)}`,
    { method: 'GET' },
  );
};

export const listServiceBookingBusySlots = async (params: {
  serviceId: string;
  providerId: string;
  bookingDate: string;
}) => {
  const searchParams = new URLSearchParams({
    serviceId: params.serviceId,
    providerId: params.providerId,
    bookingDate: params.bookingDate,
  });

  return backendRequest<ServiceBookingBusySlot[]>(
    `/api/service-bookings/busy-slots?${searchParams.toString()}`,
    { method: 'GET' },
    { requireAuth: false },
  );
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

  if (isPastBookingStart(payload.bookingDate, payload.startTime)) {
    throw new Error('Нельзя бронировать прошедшее время');
  }

  try {
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

    const booking = await backendRequest<ServiceBooking>(
      '/api/service-bookings',
      {
        method: 'POST',
        body: payload,
      },
    );

    debugInfo('service-booking.create.request.succeeded', {
      bookingId: booking.id,
      serviceId: booking.serviceId,
      providerId: booking.providerId,
      userId: booking.userId,
    });

    return booking;
  } catch (error) {
    debugError('service-booking.create.request.failed', {
      serviceId: payload.serviceId,
      providerId: payload.providerId,
      userId: payload.userId,
      bookingDate: payload.bookingDate,
      startTime: payload.startTime,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const cancelServiceBooking = async (id: string) => {
  debugInfo('service-booking.cancel.request.started', {
    bookingId: id,
  });

  const booking = await backendRequest<ServiceBooking>(
    `/api/service-bookings/${encodeURIComponent(id)}/cancel`,
    {
      method: 'POST',
    },
  );

  debugInfo('service-booking.cancel.request.succeeded', {
    bookingId: booking.id,
    serviceId: booking.serviceId,
    status: booking.status,
  });

  return booking;
};
