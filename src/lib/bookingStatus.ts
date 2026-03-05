type TimeRangeBooking = {
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: 'active' | 'cancelled';
};

export type BookingViewStatus = 'active' | 'completed' | 'cancelled';

const toDateTime = (date: string, time: string) => {
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${normalizedTime}`);
};

export const getBookingStartDateTime = (booking: Pick<TimeRangeBooking, 'bookingDate' | 'startTime'>) =>
  toDateTime(booking.bookingDate, booking.startTime);

export const getBookingEndDateTime = (booking: Pick<TimeRangeBooking, 'bookingDate' | 'endTime'>) =>
  toDateTime(booking.bookingDate, booking.endTime);

export const getBookingViewStatus = (
  booking: Pick<TimeRangeBooking, 'bookingDate' | 'endTime' | 'status'>,
  now: Date = new Date(),
): BookingViewStatus => {
  if (booking.status === 'cancelled') return 'cancelled';

  const endAt = getBookingEndDateTime(booking);
  if (Number.isNaN(endAt.getTime())) return 'active';

  return endAt.getTime() <= now.getTime() ? 'completed' : 'active';
};
