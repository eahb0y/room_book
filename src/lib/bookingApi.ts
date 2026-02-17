import type { Booking } from '@/types';
import { supabaseDbRequest } from '@/lib/supabaseHttp';

interface BookingRow {
  id: string;
  room_id: string;
  user_id: string;
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
    bookingDate: row.booking_date,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    status: row.status,
    createdAt: row.created_at,
  };
};

const isOverlapping = (startA: string, endA: string, startB: string, endB: string) =>
  startA < endB && endA > startB;

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
  bookingDate: string;
  startTime: string;
  endTime: string;
}) => {
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
        {
          room_id: payload.roomId,
          user_id: payload.userId,
          booking_date: payload.bookingDate,
          start_time: payload.startTime,
          end_time: payload.endTime,
          status: 'active',
        },
      ]),
    },
  );

  const created = rows[0];
  if (!created) throw new Error('Booking was not created');

  return mapBooking(created);
};

export const cancelBooking = async (id: string) => {
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
  if (!updated) throw new Error('Booking not found');

  return mapBooking(updated);
};

export const updateBooking = async (
  id: string,
  payload: {
    roomId: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    status?: 'active' | 'cancelled';
  },
) => {
  if (payload.status !== 'cancelled') {
    throw new Error('Разрешена только отмена бронирования');
  }

  return cancelBooking(id);
};
