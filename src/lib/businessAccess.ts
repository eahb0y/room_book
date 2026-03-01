import type { BusinessAccessRole, User, Venue } from '@/types';

export const getBusinessAccessRole = (user: User | null | undefined): BusinessAccessRole | null =>
  user?.businessAccess?.role ?? null;

export const hasBusinessAccess = (user: User | null | undefined): user is User & { businessAccess: NonNullable<User['businessAccess']> } =>
  Boolean(user?.businessAccess);

export const isBusinessPortalActive = (user: User | null | undefined, portal: 'user' | 'business' | null) =>
  portal === 'business' && hasBusinessAccess(user);

export const isBusinessOwner = (user: User | null | undefined) => getBusinessAccessRole(user) === 'business';

export const canManageBusinessResources = (user: User | null | undefined) => isBusinessOwner(user);

export const canManageBusinessStaff = (user: User | null | undefined) => isBusinessOwner(user);

export const canManageBusinessBookings = (user: User | null | undefined) => {
  const role = getBusinessAccessRole(user);
  return role === 'business' || role === 'manager';
};

export const canManageBusinessResidents = (user: User | null | undefined) => {
  const role = getBusinessAccessRole(user);
  return role === 'business' || role === 'manager';
};

export const getAccessibleBusinessVenues = (user: User | null | undefined, venues: Venue[]) => {
  if (!hasBusinessAccess(user)) return [];

  if (user.businessAccess.isOwner || user.businessAccess.role === 'business') {
    return venues.filter((venue) => venue.adminId === user.id);
  }

  return venues.filter((venue) => venue.id === user.businessAccess.venueId);
};

export const getBusinessVenueScopeKey = (user: User | null | undefined) => {
  if (!hasBusinessAccess(user)) return null;
  if (user.businessAccess.isOwner || user.businessAccess.role === 'business') {
    return 'owner';
  }
  return user.businessAccess.venueId;
};
