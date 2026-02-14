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

const mapBooking = (row: BookingRow): Booking => ({
  id: row.id,
  roomId: row.room_id,
  userId: row.user_id,
  bookingDate: row.booking_date,
  startTime: row.start_time.slice(0, 5),
  endTime: row.end_time.slice(0, 5),
  status: row.status,
  createdAt: row.created_at,
});

const isOverlapping = (startA: string, endA: string, startB: string, endB: string) =>
  startA < endB && endA > startB;

export const listBookings = async (params?: { userId?: string; venueId?: string; roomId?: string }) => {
  if (params?.venueId) {
    const filters = [
      'select=*,rooms!inner(venue_id)',
      `rooms.venue_id=eq.${encodeURIComponent(params.venueId)}`,
      'order=created_at.desc',
    ];

    if (params.userId) filters.push(`user_id=eq.${encodeURIComponent(params.userId)}`);
    if (params.roomId) filters.push(`room_id=eq.${encodeURIComponent(params.roomId)}`);

    const rows = await supabaseDbRequest<Array<BookingRow & { rooms: { venue_id: string } }>>(
      `bookings?${filters.join('&')}`,
      { method: 'GET' },
    );

    return rows.map(mapBooking);
  }

  const filters = ['select=*', 'order=created_at.desc'];
  if (params?.userId) filters.push(`user_id=eq.${encodeURIComponent(params.userId)}`);
  if (params?.roomId) filters.push(`room_id=eq.${encodeURIComponent(params.roomId)}`);

  const rows = await supabaseDbRequest<BookingRow[]>(`bookings?${filters.join('&')}`, {
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
  const existing = await supabaseDbRequest<Array<Pick<BookingRow, 'start_time' | 'end_time'>>>(
    `bookings?select=start_time,end_time&room_id=eq.${encodeURIComponent(payload.roomId)}&booking_date=eq.${encodeURIComponent(payload.bookingDate)}&status=eq.active`,
    { method: 'GET' },
  );

  const hasOverlap = existing.some((booking) =>
    isOverlapping(payload.startTime, payload.endTime, booking.start_time, booking.end_time),
  );

  if (hasOverlap) {
    throw new Error('Этот слот уже занят');
  }

  const rows = await supabaseDbRequest<BookingRow[]>(
    'bookings',
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
  const rows = await supabaseDbRequest<BookingRow[]>(
    `bookings?id=eq.${encodeURIComponent(id)}`,
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
