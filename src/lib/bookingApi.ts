import type { Booking } from '@/types';
import { debugError, debugInfo } from '@/lib/frontendDebug';
import { backendRequest } from '@/lib/backendHttp';

const isPastBookingStart = (bookingDate: string, startTime: string) => {
  const startAt = new Date(`${bookingDate}T${startTime}:00`);
  if (Number.isNaN(startAt.getTime())) return false;
  return startAt.getTime() < Date.now();
};

const buildQuery = (params?: { userId?: string; venueId?: string; roomId?: string }) => {
  const searchParams = new URLSearchParams();
  if (params?.userId) searchParams.set('userId', params.userId);
  if (params?.venueId) searchParams.set('venueId', params.venueId);
  if (params?.roomId) searchParams.set('roomId', params.roomId);
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const listBookings = async (params?: { userId?: string; venueId?: string; roomId?: string }) => {
  return backendRequest<Booking[]>(
    `/api/bookings${buildQuery(params)}`,
    { method: 'GET' },
  );
};

export const createBooking = async (payload: {
  roomId: string;
  userId: string;
  description?: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
}) => {
  debugInfo('booking.create.request.started', {
    roomId: payload.roomId,
    userId: payload.userId,
    bookingDate: payload.bookingDate,
    startTime: payload.startTime,
    endTime: payload.endTime,
    hasDescription: Boolean(payload.description?.trim()),
  });

  if (isPastBookingStart(payload.bookingDate, payload.startTime)) {
    throw new Error('Нельзя бронировать прошедшее время');
  }

  try {
    const booking = await backendRequest<Booking>(
      '/api/bookings',
      {
        method: 'POST',
        body: payload,
      },
    );

    debugInfo('booking.create.request.succeeded', {
      bookingId: booking.id,
      roomId: booking.roomId,
      userId: booking.userId,
    });

    return booking;
  } catch (error) {
    debugError('booking.create.request.failed', {
      roomId: payload.roomId,
      userId: payload.userId,
      bookingDate: payload.bookingDate,
      startTime: payload.startTime,
      endTime: payload.endTime,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const cancelBooking = async (id: string) => {
  debugInfo('booking.cancel.request.started', {
    bookingId: id,
  });

  const booking = await backendRequest<Booking>(
    `/api/bookings/${encodeURIComponent(id)}/cancel`,
    {
      method: 'POST',
    },
  );

  debugInfo('booking.cancel.request.succeeded', {
    bookingId: booking.id,
    roomId: booking.roomId,
    status: booking.status,
  });

  return booking;
};

export const updateBooking = async (
  id: string,
  payload: {
    userId: string;
    description?: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    status?: 'active' | 'cancelled';
  },
) => {
  debugInfo('booking.update.request.started', {
    bookingId: id,
    userId: payload.userId,
    bookingDate: payload.bookingDate,
    startTime: payload.startTime,
    endTime: payload.endTime,
    status: payload.status ?? 'active',
    hasDescription: Boolean(payload.description?.trim()),
  });

  if ((payload.status ?? 'active') !== 'cancelled' && isPastBookingStart(payload.bookingDate, payload.startTime)) {
    throw new Error('Нельзя бронировать прошедшее время');
  }

  try {
    const booking = await backendRequest<Booking>(
      `/api/bookings/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: payload,
      },
    );

    debugInfo('booking.update.request.succeeded', {
      bookingId: booking.id,
      roomId: booking.roomId,
      status: booking.status,
    });

    return booking;
  } catch (error) {
    debugError('booking.update.request.failed', {
      bookingId: id,
      userId: payload.userId,
      bookingDate: payload.bookingDate,
      startTime: payload.startTime,
      endTime: payload.endTime,
      status: payload.status ?? 'active',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
