import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BUSINESS_ACTIVITY_CUSTOM_ID, businessActivityOptions } from '@/lib/businessActivity';
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
  const selectId = `${idPrefix}-business-activity`;
  const customInputId = `${idPrefix}-business-activity-custom`;

  return (
    <div className="space-y-2">
      <Label htmlFor={selectId}>
        {t('Род деятельности')}
        {required ? ' *' : ''}
      </Label>
      <Select
        value={selectedValue || undefined}
        onValueChange={onSelectedValueChange}
        disabled={disabled}
      >
        <SelectTrigger id={selectId} className="h-11 w-full border-border/50 bg-input/50 focus:border-primary/60">
          <SelectValue placeholder={t('Выберите сферу бизнеса')} />
        </SelectTrigger>
        <SelectContent>
          {businessActivityOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {t(option.label)}
            </SelectItem>
          ))}
          <SelectItem value={BUSINESS_ACTIVITY_CUSTOM_ID}>
            {t('Другое (указать вручную)')}
          </SelectItem>
        </SelectContent>
      </Select>

      {selectedValue === BUSINESS_ACTIVITY_CUSTOM_ID ? (
        <Input
          id={customInputId}
          value={customValue}
          onChange={(event) => onCustomValueChange(event.target.value)}
          placeholder={t('Например: стоматология, языковая школа, барбершоп')}
          disabled={disabled}
          className="h-11 border-border/50 bg-input/50 focus:border-primary/60"
        />
      ) : null}
    </div>
  );
}
