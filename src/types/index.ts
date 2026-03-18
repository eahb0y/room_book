// User types
export type UserRole = 'admin' | 'user';
export type BusinessAccessRole = 'business' | 'manager' | 'staff';
export type BusinessStaffRole = Exclude<BusinessAccessRole, 'business'>;
export type SubscriptionBillingMode = 'monthly' | 'annual';
export type SubscriptionPlanFamily = 'free' | 'plus' | 'pro';

export interface BusinessAccess {
  venueId: string;
  venueName?: string;
  role: BusinessAccessRole;
  isOwner: boolean;
}

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  role: UserRole;
  businessAccess?: BusinessAccess | null;
  createdAt: string;
}


// Venue types
export interface Venue {
  id: string;
  name: string;
  description: string;
  address: string;
  activityType: string;
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
  description: string;
  location: string;
  accessType: 'public' | 'residents_only';
  availableFrom: string;
  availableTo: string;
  minBookingMinutes: number;
  maxBookingMinutes: number;
  capacity: number;
  services: string[];
  photoUrl?: string | null;
  photoUrls?: string[];
  createdAt: string;
}

export interface BusinessServiceProvider {
  id: string;
  name: string;
  location: string;
  workFrom?: string | null;
  workTo?: string | null;
  durationMinutes: number;
  price: number;
  photoUrl?: string | null;
}

export interface BusinessServiceCategory {
  id: string;
  venueId: string;
  name: string;
  createdAt: string;
}

export interface BusinessService {
  id: string;
  venueId: string;
  categoryId?: string | null;
  name: string;
  providers: BusinessServiceProvider[];
  photoUrl?: string | null;
  createdAt: string;
}

export interface BusinessStaffAccount {
  id: string;
  venueId: string;
  venueName?: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: BusinessStaffRole;
  isActive: boolean;
  createdByUserId: string;
  createdAt: string;
}

export interface CreatedBusinessStaffAccount extends BusinessStaffAccount {
  temporaryPassword: string;
}

export interface VenueSubscription {
  id: string;
  venueId: string;
  planId: string;
  planName: string;
  planFamily: SubscriptionPlanFamily;
  billingCycle: SubscriptionBillingMode;
  maxCalendars: number | null;
  priceMonthly: number;
  priceAnnually: number;
  currentCalendarsCount: number;
  createdAt: string;
  updatedAt: string;
}

// Booking types
export type BookingStatus = 'active' | 'cancelled';

export interface Booking {
  id: string;
  roomId: string;
  userId: string;
  userEmail?: string;
  userFirstName?: string;
  userLastName?: string;
  description?: string;
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

export interface ServiceBooking {
  id: string;
  serviceId: string;
  venueId?: string;
  providerId: string;
  providerName?: string;
  serviceName?: string;
  servicePhotoUrl?: string | null;
  userId: string;
  userEmail?: string;
  userFirstName?: string;
  userLastName?: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  createdAt: string;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export type RegisterCredentials = LoginCredentials;

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  portal: 'user' | 'business' | null;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (credentials: RegisterCredentials) => Promise<boolean>;
  refreshBusinessAccess: () => Promise<User | null>;
  startGoogleAuth: (redirectPath?: string) => void;
  startAppleAuth: (redirectPath?: string) => void;
  completeGoogleAuth: (hash: string) => Promise<boolean>;
  setPortal: (portal: 'user' | 'business') => void;
  updateProfile: (payload: {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string | null;
  }) => Promise<User>;
  changePassword: (payload: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}
