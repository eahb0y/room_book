import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';

interface PreferenceControlsProps {
  className?: string;
}

export default function PreferenceControls({ className }: PreferenceControlsProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <LanguageSwitcher />
      {!isAuthenticated ? <ThemeSwitcher /> : null}
    </div>
  );
}
