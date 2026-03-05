import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useI18n } from '@/i18n/useI18n';
import PreferenceControls from '@/components/PreferenceControls';
import { hasBusinessAccess } from '@/lib/businessAccess';

export default function BusinessLogin() {
  const { t } = useI18n();
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const setPortal = useAuthStore((state) => state.setPortal);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    setIsLoading(true);

    try {
      const success = await login({ email, password });
      if (!success) {
        setError(t('Неверные данные для входа'));
        return;
      }

      const loggedUser = useAuthStore.getState().user;
      if (!loggedUser) {
        setError(t('Не удалось выполнить вход'));
        return;
      }

      if (!hasBusinessAccess(loggedUser)) {
        await logout();
        setError(t('Этот email не подключён к бизнес-админке'));
        return;
      }

      setPortal('business');
      navigate('/my-venue');
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Произошла ошибка при входе');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[30%] h-[420px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.04] blur-[140px]" />
      </div>

      <div className="absolute right-4 top-4 z-20">
        <PreferenceControls />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <div className="mb-8 text-center">
          <img
            src="/favicon.svg"
            alt=""
            aria-hidden="true"
            className="mx-auto mb-5 h-12 w-12 rounded-xl shadow-glow"
          />
          <h1 className="text-3xl font-semibold text-foreground">{t('Вход в бизнес-кабинет')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('Только для владельцев бизнеса и администраторов площадок')}
          </p>
        </div>

        <Card className="border-border/40 shadow-xl shadow-black/20">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5 pt-6">
              {error && (
                <Alert variant="destructive" className="animate-scale-in">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-muted-foreground">
                  {t('Email')}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t('Например: team@company.com')}
                  required
                  className="h-11 border-border/50 bg-input/50 focus:border-primary/60"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-muted-foreground">
                  {t('Пароль')}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-11 border-border/50 bg-input/50 focus:border-primary/60"
                />
              </div>

              <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>{t('Вход выполняется по email и паролю')}</span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 pb-6">
              <Button type="submit" className="h-11 w-full font-medium tracking-wide" disabled={isLoading}>
                {isLoading ? t('Вход...') : t('Войти в кабинет')}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {t('Нет бизнес-аккаунта?')}{' '}
                <Link to="/business/register" className="text-primary transition-colors hover:text-primary/80">
                  {t('Зарегистрировать бизнес')}
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
