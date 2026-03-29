const CUSTOM_ACTIVITY_PREFIX = 'custom:';

export const BUSINESS_ACTIVITY_CUSTOM_ID = 'custom';
export const BUSINESS_ACTIVITY_RESTAURANT_ID = 'restaurant';

export const businessActivityOptions = [
  { id: BUSINESS_ACTIVITY_RESTAURANT_ID, label: 'Рестораны' },
] as const;

export const decodeBusinessActivityValue = (value?: string | null) => {
  const normalized = value?.trim() ?? '';

  if (!normalized) {
    return {
      selectedValue: BUSINESS_ACTIVITY_RESTAURANT_ID,
      customValue: '',
    };
  }

  if (normalized.startsWith(CUSTOM_ACTIVITY_PREFIX)) {
    return {
      selectedValue: BUSINESS_ACTIVITY_RESTAURANT_ID,
      customValue: '',
    };
  }

  const matchedOption = businessActivityOptions.find((option) => option.id === normalized);
  if (matchedOption) {
    return {
      selectedValue: matchedOption.id,
      customValue: '',
    };
  }

  return {
    selectedValue: BUSINESS_ACTIVITY_RESTAURANT_ID,
    customValue: '',
  };
};

export const encodeBusinessActivityValue = (selectedValue: string, customValue: string) => {
  if (!selectedValue) return BUSINESS_ACTIVITY_RESTAURANT_ID;

  if (selectedValue === BUSINESS_ACTIVITY_CUSTOM_ID) {
    const normalizedCustomValue = customValue.trim();
    return normalizedCustomValue ? `${CUSTOM_ACTIVITY_PREFIX}${normalizedCustomValue}` : BUSINESS_ACTIVITY_RESTAURANT_ID;
  }

  return selectedValue;
};
