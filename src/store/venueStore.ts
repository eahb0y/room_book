import { create } from 'zustand';
import type { Booking, Room, ServiceBooking, User, Venue, VenueMembership } from '@/types';
import * as venueApi from '@/lib/venueApi';
import * as roomApi from '@/lib/roomApi';
import * as bookingApi from '@/lib/bookingApi';
import * as serviceBookingApi from '@/lib/serviceBookingApi';
import * as membershipApi from '@/lib/membershipApi';
import { getBusinessVenueScopeKey, hasBusinessAccess } from '@/lib/businessAccess';
import { debugError, debugInfo } from '@/lib/frontendDebug';

interface VenueState {
  venues: Venue[];
  rooms: Room[];
  bookings: Booking[];
  serviceBookings: ServiceBooking[];
  memberships: VenueMembership[];
  isLoading: boolean;
  loadedFor: string | null;
  settledFor: string | null;

  loadAdminData: (user: User) => Promise<void>;
  loadUserData: (userId: string) => Promise<void>;
  loadRoomBookings: (roomId: string) => Promise<Booking[]>;

  createVenue: (
    venue: Omit<Venue, 'id' | 'createdAt' | 'activityType'> & { activityType?: string },
  ) => Promise<Venue>;
  updateVenue: (id: string, venue: Partial<Venue>) => Promise<Venue>;

  createRoom: (room: Omit<Room, 'id' | 'createdAt'>) => Promise<Room>;
  updateRoom: (id: string, room: Partial<Room>) => Promise<Room>;
  deleteRoom: (id: string) => Promise<void>;

  getMembership: (venueId: string, userId: string) => VenueMembership | undefined;

  createBooking: (booking: Omit<Booking, 'id' | 'createdAt' | 'status'>) => Promise<{ success: boolean; error?: string }>;
  cancelBooking: (id: string) => Promise<void>;
  createServiceBooking: (booking: {
    serviceId: string;
    providerId: string;
    userId: string;
    bookingDate: string;
    startTime: string;
  }) => Promise<{ success: boolean; booking?: ServiceBooking; error?: string }>;
  cancelServiceBooking: (id: string) => Promise<void>;
  updateBooking: (
    id: string,
    booking: Pick<Booking, 'userId' | 'description' | 'bookingDate' | 'startTime' | 'endTime' | 'status'>,
  ) => Promise<{ success: boolean; error?: string }>;

  reset: () => void;
}

const mergeById = <T extends { id: string }>(current: T[], next: T[]) => {
  const map = new Map<string, T>();
  current.forEach((item) => map.set(item.id, item));
  next.forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
};

export const useVenueStore = create<VenueState>((set, get) => ({
  venues: [],
  rooms: [],
  bookings: [],
  serviceBookings: [],
  memberships: [],
  isLoading: false,
  loadedFor: null,
  settledFor: null,

  loadAdminData: async (user) => {
    if (!hasBusinessAccess(user)) {
      throw new Error('Нет доступа к бизнес-кабинету');
    }

    const scope = getBusinessVenueScopeKey(user);
    const key = `admin:${user.id}:${scope ?? 'none'}`;
    set({ isLoading: true, loadedFor: null, settledFor: null });
    try {
      const venues = user.businessAccess.isOwner
        ? await venueApi.listVenues({ adminId: user.id })
        : await venueApi.listVenues({ venueIds: [user.businessAccess.venueId] });
      const venueIds = venues.map((venue) => venue.id);
      const rooms = venueIds.length ? await roomApi.listRooms({ venueIds }) : [];
      const bookingResults = await Promise.allSettled(
        venueIds.map((venueId) => bookingApi.listBookings({ venueId })),
      );
      const bookings = mergeById(
        [],
        bookingResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
      );
      const serviceBookingResults = await Promise.allSettled(
        venueIds.map((venueId) => serviceBookingApi.listServiceBookings({ venueId })),
      );
      const serviceBookings = mergeById(
        [],
        serviceBookingResults.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
      );
      set({ venues, rooms, bookings, serviceBookings, memberships: [], isLoading: false, loadedFor: key, settledFor: key });
    } catch (err) {
      set({ isLoading: false, settledFor: key });
      throw err;
    }
  },

  loadUserData: async (userId) => {
    const key = `user:${userId}`;
    set({ isLoading: true, loadedFor: null, settledFor: null });
    try {
      const [memberships, venues, rooms, bookings, serviceBookings] = await Promise.all([
        membershipApi.listMemberships({ userId }),
        venueApi.listVenues({ publicAccess: true }),
        roomApi.listRooms({ publicAccess: true }),
        bookingApi.listBookings({ userId }),
        serviceBookingApi.listServiceBookings({ userId }),
      ]);
      set({
        memberships,
        venues,
        rooms,
        bookings,
        serviceBookings,
        isLoading: false,
        loadedFor: key,
        settledFor: key,
      });
    } catch (err) {
      set({ isLoading: false, settledFor: key });
      throw err;
    }
  },

  loadRoomBookings: async (roomId) => {
    const bookings = await bookingApi.listBookings({ roomId });
    set((state) => ({ bookings: mergeById(state.bookings, bookings) }));
    return bookings;
  },

  createVenue: async (venueData) => {
      const venue = await venueApi.createVenue({
        name: venueData.name,
        description: venueData.description,
        address: venueData.address,
        activityType: venueData.activityType,
        adminId: venueData.adminId,
      });
    set((state) => ({ venues: mergeById(state.venues, [venue]) }));
    return venue;
  },

  updateVenue: async (id, venueData) => {
      const venue = await venueApi.updateVenue(id, {
        name: venueData.name,
        description: venueData.description,
        address: venueData.address,
        activityType: venueData.activityType,
      });
    set((state) => ({ venues: mergeById(state.venues, [venue]) }));
    return venue;
  },

  createRoom: async (roomData) => {
    const room = await roomApi.createRoom({
      name: roomData.name,
      description: roomData.description,
      location: roomData.location,
      accessType: roomData.accessType,
      availableFrom: roomData.availableFrom,
      availableTo: roomData.availableTo,
      minBookingMinutes: roomData.minBookingMinutes,
      maxBookingMinutes: roomData.maxBookingMinutes,
      capacity: roomData.capacity,
      services: roomData.services,
      venueId: roomData.venueId,
      photoUrls: roomData.photoUrls,
      photoUrl: roomData.photoUrl,
    });
    set((state) => ({ rooms: mergeById(state.rooms, [room]) }));
    return room;
  },

  updateRoom: async (id, roomData) => {
    const room = await roomApi.updateRoom(id, {
      name: roomData.name,
      description: roomData.description,
      location: roomData.location,
      accessType: roomData.accessType,
      availableFrom: roomData.availableFrom,
      availableTo: roomData.availableTo,
      minBookingMinutes: roomData.minBookingMinutes,
      maxBookingMinutes: roomData.maxBookingMinutes,
      capacity: roomData.capacity,
      services: roomData.services,
      photoUrls: roomData.photoUrls,
      photoUrl: roomData.photoUrl,
    });
    set((state) => ({ rooms: mergeById(state.rooms, [room]) }));
    return room;
  },

  deleteRoom: async (id) => {
    await roomApi.deleteRoom(id);
    set((state) => ({
      rooms: state.rooms.filter((room) => room.id !== id),
      bookings: state.bookings.filter((booking) => booking.roomId !== id),
    }));
  },

  getMembership: (venueId, userId) => {
    return get().memberships.find((m) => m.venueId === venueId && m.userId === userId);
  },

  createBooking: async (bookingData) => {
    debugInfo('booking.create.store.started', {
      roomId: bookingData.roomId,
      userId: bookingData.userId,
      bookingDate: bookingData.bookingDate,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
    });

    try {
      const booking = await bookingApi.createBooking({
        roomId: bookingData.roomId,
        userId: bookingData.userId,
        description: bookingData.description,
        bookingDate: bookingData.bookingDate,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
      });
      set((state) => ({ bookings: mergeById(state.bookings, [booking]) }));
      debugInfo('booking.create.store.succeeded', {
        bookingId: booking.id,
        roomId: booking.roomId,
        userId: booking.userId,
      });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Произошла ошибка при бронировании';
      debugError('booking.create.store.failed', {
        roomId: bookingData.roomId,
        userId: bookingData.userId,
        bookingDate: bookingData.bookingDate,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        error: message,
      });
      return { success: false, error: message };
    }
  },

  cancelBooking: async (id) => {
    debugInfo('booking.cancel.store.started', {
      bookingId: id,
    });
    const booking = await bookingApi.cancelBooking(id);
    set((state) => ({ bookings: mergeById(state.bookings, [booking]) }));
    debugInfo('booking.cancel.store.succeeded', {
      bookingId: booking.id,
      roomId: booking.roomId,
      status: booking.status,
    });
  },

  createServiceBooking: async (bookingData) => {
    debugInfo('service-booking.create.store.started', {
      serviceId: bookingData.serviceId,
      providerId: bookingData.providerId,
      userId: bookingData.userId,
      bookingDate: bookingData.bookingDate,
      startTime: bookingData.startTime,
    });

    try {
      const booking = await serviceBookingApi.createServiceBooking(bookingData);
      set((state) => ({ serviceBookings: mergeById(state.serviceBookings, [booking]) }));
      debugInfo('service-booking.create.store.succeeded', {
        bookingId: booking.id,
        serviceId: booking.serviceId,
        providerId: booking.providerId,
        userId: booking.userId,
      });
      return { success: true, booking };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Произошла ошибка при бронировании услуги';
      debugError('service-booking.create.store.failed', {
        serviceId: bookingData.serviceId,
        providerId: bookingData.providerId,
        userId: bookingData.userId,
        bookingDate: bookingData.bookingDate,
        startTime: bookingData.startTime,
        error: message,
      });
      return { success: false, error: message };
    }
  },

  cancelServiceBooking: async (id) => {
    debugInfo('service-booking.cancel.store.started', {
      bookingId: id,
    });
    const booking = await serviceBookingApi.cancelServiceBooking(id);
    set((state) => ({ serviceBookings: mergeById(state.serviceBookings, [booking]) }));
    debugInfo('service-booking.cancel.store.succeeded', {
      bookingId: booking.id,
      serviceId: booking.serviceId,
      status: booking.status,
    });
  },

  updateBooking: async (id, bookingData) => {
    debugInfo('booking.update.store.started', {
      bookingId: id,
      userId: bookingData.userId,
      bookingDate: bookingData.bookingDate,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      status: bookingData.status,
    });

    try {
      const booking = await bookingApi.updateBooking(id, {
        userId: bookingData.userId,
        description: bookingData.description,
        bookingDate: bookingData.bookingDate,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        status: bookingData.status,
      });
      set((state) => ({ bookings: mergeById(state.bookings, [booking]) }));
      debugInfo('booking.update.store.succeeded', {
        bookingId: booking.id,
        roomId: booking.roomId,
        status: booking.status,
      });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Произошла ошибка при сохранении';
      debugError('booking.update.store.failed', {
        bookingId: id,
        userId: bookingData.userId,
        bookingDate: bookingData.bookingDate,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        status: bookingData.status,
        error: message,
      });
      return { success: false, error: message };
    }
  },

  reset: () => {
    set({
      venues: [],
      rooms: [],
      bookings: [],
      serviceBookings: [],
      memberships: [],
      isLoading: false,
      loadedFor: null,
      settledFor: null,
    });
  },
}));
