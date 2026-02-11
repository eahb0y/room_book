import type { Booking } from '@/types';
import { request } from '@/lib/apiClient';

export const listBookings = async (params?: { userId?: string; venueId?: string; roomId?: string }) => {
  const search = new URLSearchParams();
  if (params?.userId) search.set('userId', params.userId);
  if (params?.venueId) search.set('venueId', params.venueId);
  if (params?.roomId) search.set('roomId', params.roomId);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  const data = await request<{ bookings: Booking[] }>(`/api/bookings${suffix}`);
  return data.bookings;
};

export const createBooking = async (payload: {
  roomId: string;
  userId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
}) => {
  const data = await request<{ booking: Booking }>('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.booking;
};

export const cancelBooking = async (id: string) => {
  const data = await request<{ booking: Booking }>(`/api/bookings/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  });
  return data.booking;
};
