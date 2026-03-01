const CUSTOM_ACTIVITY_PREFIX = 'custom:';

export const BUSINESS_ACTIVITY_CUSTOM_ID = 'custom';

export const businessActivityOptions = [
  { id: 'coworking_office', label: 'Коворкинг и офисы' },
  { id: 'education', label: 'Обучение' },
  { id: 'medicine', label: 'Медицина' },
  { id: 'beauty_care', label: 'Красота и уход' },
  { id: 'fitness_wellbeing', label: 'Фитнес и wellbeing' },
  { id: 'events', label: 'Ивенты и мероприятия' },
  { id: 'creative_studio', label: 'Студия и креатив' },
  { id: 'consulting_services', label: 'Консультации и сервис' },
] as const;

export const decodeBusinessActivityValue = (value?: string | null) => {
  const normalized = value?.trim() ?? '';

  if (!normalized) {
    return {
      selectedValue: '',
      customValue: '',
    };
  }

  if (normalized.startsWith(CUSTOM_ACTIVITY_PREFIX)) {
    return {
      selectedValue: BUSINESS_ACTIVITY_CUSTOM_ID,
      customValue: normalized.slice(CUSTOM_ACTIVITY_PREFIX.length).trim(),
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
    selectedValue: BUSINESS_ACTIVITY_CUSTOM_ID,
    customValue: normalized,
  };
};

export const encodeBusinessActivityValue = (selectedValue: string, customValue: string) => {
  if (!selectedValue) return '';

  if (selectedValue === BUSINESS_ACTIVITY_CUSTOM_ID) {
    const normalizedCustomValue = customValue.trim();
    return normalizedCustomValue ? `${CUSTOM_ACTIVITY_PREFIX}${normalizedCustomValue}` : '';
  }

  return selectedValue;
};
