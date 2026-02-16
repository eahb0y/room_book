import { create } from 'zustand';
import type { Booking, Room, Venue, VenueMembership } from '@/types';
import * as venueApi from '@/lib/venueApi';
import * as roomApi from '@/lib/roomApi';
import * as bookingApi from '@/lib/bookingApi';
import * as membershipApi from '@/lib/membershipApi';

interface VenueState {
  venues: Venue[];
  rooms: Room[];
  bookings: Booking[];
  memberships: VenueMembership[];
  isLoading: boolean;
  loadedFor: string | null;

  loadAdminData: (adminId: string) => Promise<void>;
  loadUserData: (userId: string) => Promise<void>;
  loadRoomBookings: (roomId: string) => Promise<Booking[]>;

  createVenue: (venue: Omit<Venue, 'id' | 'createdAt'>) => Promise<Venue>;
  updateVenue: (id: string, venue: Partial<Venue>) => Promise<Venue>;

  createRoom: (room: Omit<Room, 'id' | 'createdAt'>) => Promise<Room>;
  updateRoom: (id: string, room: Partial<Room>) => Promise<Room>;
  deleteRoom: (id: string) => Promise<void>;

  getMembership: (venueId: string, userId: string) => VenueMembership | undefined;

  createBooking: (booking: Omit<Booking, 'id' | 'createdAt' | 'status'>) => Promise<{ success: boolean; error?: string }>;
  cancelBooking: (id: string) => Promise<void>;
  updateBooking: (
    id: string,
    booking: Pick<Booking, 'roomId' | 'bookingDate' | 'startTime' | 'endTime' | 'status'>,
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
  memberships: [],
  isLoading: false,
  loadedFor: null,

  loadAdminData: async (adminId) => {
    set({ isLoading: true, loadedFor: null });
    try {
      const venues = await venueApi.listVenues({ adminId });
      const venueIds = venues.map((venue) => venue.id);
      const rooms = venueIds.length ? await roomApi.listRooms({ venueIds }) : [];
      const bookingLists = await Promise.all(
        venueIds.map((venueId) => bookingApi.listBookings({ venueId }))
      );
      const bookings = mergeById([], bookingLists.flat());
      set({ venues, rooms, bookings, memberships: [], isLoading: false, loadedFor: `admin:${adminId}` });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  loadUserData: async (userId) => {
    set({ isLoading: true, loadedFor: null });
    try {
      const memberships = await membershipApi.listMemberships({ userId });
      const venues = await venueApi.listVenues({ userId });
      const venueIds = venues.map((venue) => venue.id);
      const rooms = venueIds.length ? await roomApi.listRooms({ venueIds }) : [];
      const bookings = await bookingApi.listBookings({ userId });
      set({ memberships, venues, rooms, bookings, isLoading: false, loadedFor: `user:${userId}` });
    } catch (err) {
      set({ isLoading: false });
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
    });
    set((state) => ({ venues: mergeById(state.venues, [venue]) }));
    return venue;
  },

  createRoom: async (roomData) => {
    const room = await roomApi.createRoom({
      name: roomData.name,
      capacity: roomData.capacity,
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
      capacity: roomData.capacity,
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
    try {
      const booking = await bookingApi.createBooking({
        roomId: bookingData.roomId,
        userId: bookingData.userId,
        bookingDate: bookingData.bookingDate,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
      });
      set((state) => ({ bookings: mergeById(state.bookings, [booking]) }));
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Произошла ошибка при бронировании';
      return { success: false, error: message };
    }
  },

  cancelBooking: async (id) => {
    const booking = await bookingApi.cancelBooking(id);
    set((state) => ({ bookings: mergeById(state.bookings, [booking]) }));
  },

  updateBooking: async (id, bookingData) => {
    try {
      const booking = await bookingApi.updateBooking(id, {
        roomId: bookingData.roomId,
        bookingDate: bookingData.bookingDate,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        status: bookingData.status,
      });
      set((state) => ({ bookings: mergeById(state.bookings, [booking]) }));
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Произошла ошибка при сохранении';
      return { success: false, error: message };
    }
  },

  reset: () => {
    set({ venues: [], rooms: [], bookings: [], memberships: [], isLoading: false, loadedFor: null });
  },
}));
