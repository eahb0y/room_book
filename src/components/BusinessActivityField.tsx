import { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BUSINESS_ACTIVITY_RESTAURANT_ID, businessActivityOptions } from '@/lib/businessActivity';
import { useI18n } from '@/i18n/useI18n';

interface BusinessActivityFieldProps {
  customValue: string;
  disabled?: boolean;
  idPrefix: string;
  onCustomValueChange: (value: string) => void;
  onSelectedValueChange: (value: string) => void;
  required?: boolean;
  selectedValue: string;
}

export default function BusinessActivityField({
  customValue,
  disabled = false,
  idPrefix,
  onCustomValueChange,
  onSelectedValueChange,
  required = false,
  selectedValue,
}: BusinessActivityFieldProps) {
  const { t } = useI18n();
  const activityInputId = `${idPrefix}-business-activity`;

  useEffect(() => {
    if (selectedValue !== BUSINESS_ACTIVITY_RESTAURANT_ID) {
      onSelectedValueChange(BUSINESS_ACTIVITY_RESTAURANT_ID);
    }

    if (customValue) {
      onCustomValueChange('');
    }
  }, [customValue, onCustomValueChange, onSelectedValueChange, selectedValue]);

  return (
    <div className="space-y-2">
      <Label htmlFor={activityInputId}>
        {t('Род деятельности')}
        {required ? ' *' : ''}
      </Label>
      <Input
        id={activityInputId}
        value={t(businessActivityOptions[0].label)}
        readOnly
        disabled={disabled}
        className="h-11 border-border/50 bg-input/50 focus:border-primary/60"
      />
    </div>
  );
}
