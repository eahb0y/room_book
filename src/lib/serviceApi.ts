import type { BusinessService, BusinessServiceCategory, BusinessServiceProvider } from '@/types';
import { backendRequest } from '@/lib/backendHttp';

const buildQuery = (params: { venueId?: string; publicAccess?: boolean } = {}) => {
  const searchParams = new URLSearchParams();
  if (params.venueId) searchParams.set('venueId', params.venueId);
  if (params.publicAccess) searchParams.set('public', '1');
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const listBusinessServiceCategories = async (params: { venueId?: string; publicAccess?: boolean } = {}) => {
  return backendRequest<BusinessServiceCategory[]>(
    `/api/service-categories${buildQuery(params)}`,
    { method: 'GET' },
    { requireAuth: false },
  );
};

export const createBusinessServiceCategory = async (payload: { venueId: string; name: string }) => {
  return backendRequest<BusinessServiceCategory>(
    '/api/service-categories',
    {
      method: 'POST',
      body: payload,
    },
  );
};

export const updateBusinessServiceCategory = async (
  id: string,
  payload: { name?: string },
) => {
  return backendRequest<BusinessServiceCategory>(
    `/api/service-categories/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: payload,
    },
  );
};

export const listBusinessServices = async (params: { venueId?: string; publicAccess?: boolean } = {}) => {
  return backendRequest<BusinessService[]>(
    `/api/services${buildQuery(params)}`,
    { method: 'GET' },
    { requireAuth: false },
  );
};

export const getBusinessServiceById = async (id: string, _params: { publicAccess?: boolean } = {}) => {
  return backendRequest<BusinessService>(
    `/api/services/${encodeURIComponent(id)}`,
    { method: 'GET' },
    { requireAuth: false },
  );
};

export const createBusinessService = async (payload: {
  venueId: string;
  categoryId: string;
  name: string;
  providers: BusinessServiceProvider[];
  photoUrl?: string | null;
}) => {
  return backendRequest<BusinessService>(
    '/api/services',
    {
      method: 'POST',
      body: payload,
    },
  );
};

export const updateBusinessService = async (
  id: string,
  payload: {
    categoryId?: string | null;
    name?: string;
    providers?: BusinessServiceProvider[];
    photoUrl?: string | null;
  },
) => {
  return backendRequest<BusinessService>(
    `/api/services/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: payload,
    },
  );
};

export const deleteBusinessService = async (id: string) => {
  await backendRequest<{ id: string; deleted: boolean }>(
    `/api/services/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  );
};
