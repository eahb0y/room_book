import type { Booking } from '@/types';
import { debugError, debugInfo, debugWarn } from '@/lib/frontendDebug';
import { supabaseDbRequest } from '@/lib/supabaseHttp';

interface BookingRow {
  id: string;
  room_id: string;
  user_id: string;
  description?: string | null;
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

type BookingRowWithProfile = BookingRow & {
  booker?: BookingProfileRow | BookingProfileRow[] | null;
};

const bookingSelectWithProfile = '*,booker:profiles!bookings_user_id_fkey(email,first_name,last_name)';

const resolveBookerProfile = (booker: BookingRowWithProfile['booker']) => {
  if (Array.isArray(booker)) {
    return booker[0] ?? null;
  }

  return booker ?? null;
};

const mapBooking = (row: BookingRowWithProfile): Booking => {
  const booker = resolveBookerProfile(row.booker);

  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    userEmail: booker?.email ?? undefined,
    userFirstName: booker?.first_name ?? undefined,
    userLastName: booker?.last_name ?? undefined,
    description: row.description?.trim() ? row.description : undefined,
    bookingDate: row.booking_date,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    status: row.status,
    createdAt: row.created_at,
  };
};

const isOverlapping = (startA: string, endA: string, startB: string, endB: string) =>
  startA < endB && endA > startB;

const isPastBookingStart = (bookingDate: string, startTime: string) => {
  const startAt = new Date(`${bookingDate}T${startTime}:00`);
  if (Number.isNaN(startAt.getTime())) return false;
  return startAt.getTime() < Date.now();
};

const isMissingBookingDescriptionColumnError = (error: unknown) =>
  error instanceof Error &&
  error.message.includes("Could not find the 'description' column of 'bookings' in the schema cache");

const buildBookingMutationPayload = (
  payload: {
    userId: string;
    description?: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    status?: 'active' | 'cancelled';
  },
  options?: { roomId?: string; includeDescription?: boolean },
) => {
  const body: Record<string, string> = {
    user_id: payload.userId,
    booking_date: payload.bookingDate,
    start_time: payload.startTime,
    end_time: payload.endTime,
    status: payload.status ?? 'active',
  };

  if (options?.roomId) {
    body.room_id = options.roomId;
  }

  if (options?.includeDescription ?? true) {
    body.description = payload.description?.trim() || '';
  }

  return body;
};

const ensureNoOverlap = async (params: {
  roomId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  excludeId?: string;
}) => {
  const filters = [
    'select=start_time,end_time',
    `room_id=eq.${encodeURIComponent(params.roomId)}`,
    `booking_date=eq.${encodeURIComponent(params.bookingDate)}`,
    'status=eq.active',
  ];

  if (params.excludeId) {
    filters.push(`id=neq.${encodeURIComponent(params.excludeId)}`);
  }

  const existing = await supabaseDbRequest<Array<Pick<BookingRow, 'start_time' | 'end_time'>>>(
    `bookings?${filters.join('&')}`,
    { method: 'GET' },
  );

  const hasOverlap = existing.some((booking) =>
    isOverlapping(params.startTime, params.endTime, booking.start_time, booking.end_time),
  );

  if (hasOverlap) {
    throw new Error('Этот слот уже занят');
  }
};

export const listBookings = async (params?: { userId?: string; venueId?: string; roomId?: string }) => {
  if (params?.venueId) {
    const filters = [
      `select=${bookingSelectWithProfile},rooms!inner(venue_id)`,
      `rooms.venue_id=eq.${encodeURIComponent(params.venueId)}`,
      'order=created_at.desc',
    ];

    if (params.userId) filters.push(`user_id=eq.${encodeURIComponent(params.userId)}`);
    if (params.roomId) filters.push(`room_id=eq.${encodeURIComponent(params.roomId)}`);

    const rows = await supabaseDbRequest<Array<BookingRowWithProfile & { rooms: { venue_id: string } }>>(
      `bookings?${filters.join('&')}`,
      { method: 'GET' },
    );

    return rows.map(mapBooking);
  }

  const filters = [`select=${bookingSelectWithProfile}`, 'order=created_at.desc'];
  if (params?.userId) filters.push(`user_id=eq.${encodeURIComponent(params.userId)}`);
  if (params?.roomId) filters.push(`room_id=eq.${encodeURIComponent(params.roomId)}`);

  const rows = await supabaseDbRequest<BookingRowWithProfile[]>(`bookings?${filters.join('&')}`, {
    method: 'GET',
  });

  return rows.map(mapBooking);
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

  await ensureNoOverlap({
    roomId: payload.roomId,
    bookingDate: payload.bookingDate,
    startTime: payload.startTime,
    endTime: payload.endTime,
  });

  const rows = await supabaseDbRequest<BookingRowWithProfile[]>(
    `bookings?select=${bookingSelectWithProfile}`,
    {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify([
        buildBookingMutationPayload(payload, {
          roomId: payload.roomId,
        }),
      ]),
    },
  ).catch(async (error) => {
    if (!isMissingBookingDescriptionColumnError(error)) {
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

    debugWarn('booking.create.request.retry_without_description', {
      roomId: payload.roomId,
      userId: payload.userId,
      bookingDate: payload.bookingDate,
      startTime: payload.startTime,
      endTime: payload.endTime,
      error: error.message,
    });

    return supabaseDbRequest<BookingRowWithProfile[]>(
      `bookings?select=${bookingSelectWithProfile}`,
      {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify([
          buildBookingMutationPayload(payload, {
            roomId: payload.roomId,
            includeDescription: false,
          }),
        ]),
      },
    );
  });

  const created = rows[0];
  if (!created) throw new Error('Не удалось создать бронирование');

  debugInfo('booking.create.request.succeeded', {
    bookingId: created.id,
    roomId: created.room_id,
    userId: created.user_id,
    bookingDate: created.booking_date,
    startTime: created.start_time,
    endTime: created.end_time,
    status: created.status,
    createdAt: created.created_at,
  });

  return mapBooking(created);
};

export const cancelBooking = async (id: string) => {
  debugInfo('booking.cancel.request.started', {
    bookingId: id,
  });

  const rows = await supabaseDbRequest<BookingRowWithProfile[]>(
    `bookings?id=eq.${encodeURIComponent(id)}&select=${bookingSelectWithProfile}`,
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
  if (!updated) throw new Error('Бронирование не найдено');

  debugInfo('booking.cancel.request.succeeded', {
    bookingId: updated.id,
    roomId: updated.room_id,
    status: updated.status,
  });

  return mapBooking(updated);
};

const getBookingById = async (id: string) => {
  const rows = await supabaseDbRequest<BookingRowWithProfile[]>(
    `bookings?id=eq.${encodeURIComponent(id)}&select=${bookingSelectWithProfile}&limit=1`,
    { method: 'GET' },
  );

  const booking = rows[0];
  if (!booking) throw new Error('Бронирование не найдено');
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

  const current = await getBookingById(id);

  if (payload.status === 'cancelled') {
    return cancelBooking(id);
  }

  await ensureNoOverlap({
    roomId: current.room_id,
    bookingDate: payload.bookingDate,
    startTime: payload.startTime,
    endTime: payload.endTime,
    excludeId: id,
  });

  const rows = await supabaseDbRequest<BookingRowWithProfile[]>(
    `bookings?id=eq.${encodeURIComponent(id)}&select=${bookingSelectWithProfile}`,
    {
      method: 'PATCH',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify(
        buildBookingMutationPayload(
          {
            ...payload,
            status: payload.status ?? current.status ?? 'active',
          },
          {
            includeDescription: true,
          },
        ),
      ),
    },
  ).catch(async (error) => {
    if (!isMissingBookingDescriptionColumnError(error)) {
      debugError('booking.update.request.failed', {
        bookingId: id,
        roomId: current.room_id,
        userId: payload.userId,
        bookingDate: payload.bookingDate,
        startTime: payload.startTime,
        endTime: payload.endTime,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    debugWarn('booking.update.request.retry_without_description', {
      bookingId: id,
      roomId: current.room_id,
      userId: payload.userId,
      bookingDate: payload.bookingDate,
      startTime: payload.startTime,
      endTime: payload.endTime,
      error: error.message,
    });

    return supabaseDbRequest<BookingRowWithProfile[]>(
      `bookings?id=eq.${encodeURIComponent(id)}&select=${bookingSelectWithProfile}`,
      {
        method: 'PATCH',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify(
          buildBookingMutationPayload(
            {
              ...payload,
              status: payload.status ?? current.status ?? 'active',
            },
            {
              includeDescription: false,
            },
          ),
        ),
      },
    );
  });

  const updated = rows[0];
  if (!updated) throw new Error('Бронирование не найдено');

  debugInfo('booking.update.request.succeeded', {
    bookingId: updated.id,
    roomId: updated.room_id,
    userId: updated.user_id,
    bookingDate: updated.booking_date,
    startTime: updated.start_time,
    endTime: updated.end_time,
    status: updated.status,
  });

  return mapBooking(updated);
};
