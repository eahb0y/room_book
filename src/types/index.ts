// User types
export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  createdAt: string;
}


// Venue types
export interface Venue {
  id: string;
  name: string;
  description: string;
  address: string;
  adminId: string;
  createdAt: string;
}

export type VenueMemberRole = 'member' | 'manager';

export type InvitationConnectionStatus = 'pending' | 'connected';

export interface VenueMembership {
  id: string;
  venueId: string;
  userId: string;
  role: VenueMemberRole;
  joinedAt: string;
  invitationId?: string;
}

export interface Invitation {
  id: string;
  venueId: string;
  venueName?: string;
  token: string;
  createdByUserId: string;
  inviteeUserId?: string;
  inviteeFirstName?: string;
  inviteeLastName?: string;
  inviteeEmail?: string;
  createdAt: string;
  expiresAt?: string;
  maxUses?: number;
  uses: number;
  revokedAt?: string;
  status?: InvitationConnectionStatus;
  connectedAt?: string;
  connectedUserId?: string;
}

// Room types
export interface Room {
  id: string;
  venueId: string;
  name: string;
  capacity: number;
  createdAt: string;
}

// Booking types
export type BookingStatus = 'active' | 'cancelled';

export interface Booking {
  id: string;
  roomId: string;
  userId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  createdAt: string;
}

export interface BookingWithDetails extends Booking {
  roomName?: string;
  venueName?: string;
  userEmail?: string;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  role: UserRole;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (credentials: RegisterCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
}
