import { useVenueStore } from '@/store/venueStore';
import type { User } from '@/types';

export const useVenueDataGuard = (user: User | null) => {
  const isVenueStoreLoading = useVenueStore((state) => state.isLoading);
  const loadedFor = useVenueStore((state) => state.loadedFor);
  const settledFor = useVenueStore((state) => state.settledFor);

  const expectedLoadedFor = user ? `${user.role}:${user.id}` : null;
  const isScopeSettled = expectedLoadedFor !== null && settledFor === expectedLoadedFor;
  const isVenueDataLoading = expectedLoadedFor !== null && (isVenueStoreLoading || !isScopeSettled);
  const isVenueDataReady = expectedLoadedFor !== null && loadedFor === expectedLoadedFor && isScopeSettled && !isVenueStoreLoading;

  return {
    isVenueDataLoading,
    isVenueDataReady,
  };
};
