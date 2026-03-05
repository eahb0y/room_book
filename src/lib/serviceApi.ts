import type { BusinessService, BusinessServiceCategory, BusinessServiceProvider } from '@/types';
import { supabaseDbRequest } from '@/lib/supabaseHttp';

interface BusinessServiceRow {
  id: string;
  venue_id: string;
  category_id?: string | null;
  name: string;
  providers: unknown;
  photo_url: string | null;
  created_at: string;
}

interface BusinessServiceCategoryRow {
  id: string;
  venue_id: string;
  name: string;
  created_at: string;
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    const candidates = [record.message, record.msg, record.detail, record.hint, record.error];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate;
      }
    }
  }

  return '';
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const isMissingBusinessServicesSchemaError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return (
    (
      message.includes('business_services')
      || message.includes('business_service_categories')
      || message.includes('category_id')
    )
    && (
      message.includes('schema cache')
      || message.includes('could not find the table')
      || message.includes('could not find the')
      || message.includes('relation')
      || message.includes('does not exist')
      || message.includes('pgrst')
      || message.includes('42p01')
    )
  );
};

const normalizeBusinessServicesTableError = (error: unknown) => {
  if (isMissingBusinessServicesSchemaError(error)) {
    return new Error('Таблицы сервисов и категорий ещё не созданы. Примените миграции services/categories и обновите schema cache.');
  }

  return error instanceof Error ? error : new Error('Не удалось загрузить сервисы');
};

const normalizeProvider = (value: unknown): BusinessServiceProvider | null => {
  if (!isRecord(value)) return null;

  const id = typeof value.id === 'string'
    ? value.id
    : typeof value.staffId === 'string'
      ? value.staffId
      : typeof value.staff_id === 'string'
        ? value.staff_id
        : typeof value.userId === 'string'
          ? value.userId
          : typeof value.user_id === 'string'
            ? value.user_id
            : '';
  const name = typeof value.name === 'string'
    ? value.name
    : typeof value.userName === 'string'
      ? value.userName
      : typeof value.user_name === 'string'
        ? value.user_name
        : '';
  const location = typeof value.location === 'string' ? value.location : '';
  const workFrom = typeof value.workFrom === 'string'
    ? value.workFrom
    : typeof value.work_from === 'string'
      ? value.work_from
      : null;
  const workTo = typeof value.workTo === 'string'
    ? value.workTo
    : typeof value.work_to === 'string'
      ? value.work_to
      : null;
  const durationMinutes = normalizeNumber(
    typeof value.durationMinutes !== 'undefined'
      ? value.durationMinutes
      : typeof value.duration_minutes !== 'undefined'
        ? value.duration_minutes
        : 0,
  );
  const price = normalizeNumber(value.price);
  const photoUrl = typeof value.photoUrl === 'string'
    ? value.photoUrl
    : typeof value.photo_url === 'string'
      ? value.photo_url
      : null;

  const normalizedId = id.trim();
  const normalizedName = name.trim();
  const normalizedLocation = location.trim();

  if (!normalizedId || !normalizedName) {
    return null;
  }

  return {
    id: normalizedId,
    name: normalizedName,
    location: normalizedLocation,
    workFrom: workFrom?.trim() || null,
    workTo: workTo?.trim() || null,
    durationMinutes: Math.max(0, Math.round(durationMinutes)),
    price: Math.max(0, price),
    photoUrl: photoUrl?.trim() || null,
  };
};

const normalizeProviders = (value: unknown): BusinessServiceProvider[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map(normalizeProvider)
    .filter((provider): provider is BusinessServiceProvider => provider !== null);
};

const mapBusinessService = (row: BusinessServiceRow): BusinessService => ({
  id: row.id,
  venueId: row.venue_id,
  categoryId: row.category_id ?? null,
  name: row.name,
  providers: normalizeProviders(row.providers),
  photoUrl: row.photo_url ?? null,
  createdAt: row.created_at,
});

const mapBusinessServiceCategory = (row: BusinessServiceCategoryRow): BusinessServiceCategory => ({
  id: row.id,
  venueId: row.venue_id,
  name: row.name,
  createdAt: row.created_at,
});

export const listBusinessServiceCategories = async (params: { venueId?: string; publicAccess?: boolean } = {}) => {
  try {
    const filters = ['select=*', 'order=created_at.asc'];

    if (params.venueId) {
      filters.push(`venue_id=eq.${encodeURIComponent(params.venueId)}`);
    }

    const rows = await supabaseDbRequest<BusinessServiceCategoryRow[]>(
      `business_service_categories?${filters.join('&')}`,
      {
        method: 'GET',
      },
      { requireAuth: !params.publicAccess },
    );

    return rows.map(mapBusinessServiceCategory);
  } catch (error) {
    throw normalizeBusinessServicesTableError(error);
  }
};

export const createBusinessServiceCategory = async (payload: { venueId: string; name: string }) => {
  try {
    const rows = await supabaseDbRequest<BusinessServiceCategoryRow[]>(
      'business_service_categories',
      {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify([
          {
            venue_id: payload.venueId,
            name: payload.name.trim(),
          },
        ]),
      },
    );

    const created = rows[0];
    if (!created) throw new Error('Не удалось создать категорию');

    return mapBusinessServiceCategory(created);
  } catch (error) {
    throw normalizeBusinessServicesTableError(error);
  }
};

export const updateBusinessServiceCategory = async (
  id: string,
  payload: {
    name?: string;
  },
) => {
  const patch: Record<string, unknown> = {};

  if (payload.name !== undefined) patch.name = payload.name.trim();

  try {
    const rows = await supabaseDbRequest<BusinessServiceCategoryRow[]>(
      `business_service_categories?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify(patch),
      },
    );

    const updated = rows[0];
    if (!updated) throw new Error('Категория не найдена');

    return mapBusinessServiceCategory(updated);
  } catch (error) {
    throw normalizeBusinessServicesTableError(error);
  }
};

export const listBusinessServices = async (params: { venueId?: string; publicAccess?: boolean } = {}) => {
  try {
    const filters = ['select=*', 'order=created_at.desc'];

    if (params.venueId) {
      filters.push(`venue_id=eq.${encodeURIComponent(params.venueId)}`);
    }

    const rows = await supabaseDbRequest<BusinessServiceRow[]>(
      `business_services?${filters.join('&')}`,
      {
        method: 'GET',
      },
      { requireAuth: !params.publicAccess },
    );

    return rows.map(mapBusinessService);
  } catch (error) {
    throw normalizeBusinessServicesTableError(error);
  }
};

export const getBusinessServiceById = async (id: string, params: { publicAccess?: boolean } = {}) => {
  try {
    const rows = await supabaseDbRequest<BusinessServiceRow[]>(
      `business_services?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
      {
        method: 'GET',
      },
      { requireAuth: !params.publicAccess },
    );

    const service = rows[0];
    if (!service) {
      throw new Error('Сервис не найден');
    }

    return mapBusinessService(service);
  } catch (error) {
    throw normalizeBusinessServicesTableError(error);
  }
};

export const createBusinessService = async (payload: {
  venueId: string;
  categoryId: string;
  name: string;
  providers: BusinessServiceProvider[];
  photoUrl?: string | null;
}) => {
  try {
    const rows = await supabaseDbRequest<BusinessServiceRow[]>(
      'business_services',
      {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify([
          {
            venue_id: payload.venueId,
            category_id: payload.categoryId,
            name: payload.name.trim(),
            providers: payload.providers,
            photo_url: payload.photoUrl ?? null,
          },
        ]),
      },
    );

    const created = rows[0];
    if (!created) throw new Error('Не удалось создать сервис');

    return mapBusinessService(created);
  } catch (error) {
    throw normalizeBusinessServicesTableError(error);
  }
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
  const patch: Record<string, unknown> = {};

  if (payload.categoryId !== undefined) patch.category_id = payload.categoryId;
  if (payload.name !== undefined) patch.name = payload.name.trim();
  if (payload.providers !== undefined) patch.providers = payload.providers;
  if (payload.photoUrl !== undefined) patch.photo_url = payload.photoUrl;

  try {
    const rows = await supabaseDbRequest<BusinessServiceRow[]>(
      `business_services?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: {
          Prefer: 'return=representation',
        },
        body: JSON.stringify(patch),
      },
    );

    const updated = rows[0];
    if (!updated) throw new Error('Сервис не найден');

    return mapBusinessService(updated);
  } catch (error) {
    throw normalizeBusinessServicesTableError(error);
  }
};

export const deleteBusinessService = async (id: string) => {
  try {
    await supabaseDbRequest<unknown>(
      `business_services?id=eq.${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    );
  } catch (error) {
    throw normalizeBusinessServicesTableError(error);
  }
};
