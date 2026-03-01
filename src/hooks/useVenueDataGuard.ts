import { useVenueStore } from '@/store/venueStore';
import type { User } from '@/types';
import { getBusinessVenueScopeKey } from '@/lib/businessAccess';

export const useVenueDataGuard = (user: User | null, scope?: 'admin' | 'user') => {
  const isVenueStoreLoading = useVenueStore((state) => state.isLoading);
  const loadedFor = useVenueStore((state) => state.loadedFor);
  const settledFor = useVenueStore((state) => state.settledFor);

  const resolvedScope = scope ?? user?.role ?? null;
  const expectedLoadedFor = user && resolvedScope
    ? resolvedScope === 'admin'
      ? `admin:${user.id}:${getBusinessVenueScopeKey(user) ?? 'none'}`
      : `user:${user.id}`
    : null;
  const isScopeSettled = expectedLoadedFor !== null && settledFor === expectedLoadedFor;
  const isVenueDataLoading = expectedLoadedFor !== null && (isVenueStoreLoading || !isScopeSettled);
  const isVenueDataReady = expectedLoadedFor !== null && loadedFor === expectedLoadedFor && isScopeSettled && !isVenueStoreLoading;

  return {
    isVenueDataLoading,
    isVenueDataReady,
  };
};
