import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { getOAuthCallbackErrorMessage } from '@/lib/authApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useI18n } from '@/i18n/useI18n';
import PreferenceControls from '@/components/PreferenceControls';
import { isBusinessPortalActive } from '@/lib/businessAccess';

export default function Login() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const startGoogleAuth = useAuthStore((state) => state.startGoogleAuth);
  const completeGoogleAuth = useAuthStore((state) => state.completeGoogleAuth);
  const searchParams = new URLSearchParams(location.search);
  const inviteToken = searchParams.get('invite');
  const nextPathParam = searchParams.get('next');
  const nextPath = nextPathParam && nextPathParam.startsWith('/') && !nextPathParam.startsWith('//') ? nextPathParam : null;
  const oauthReturnParams = new URLSearchParams();
  if (inviteToken) oauthReturnParams.set('invite', inviteToken);
  if (nextPath) oauthReturnParams.set('next', nextPath);
  const oauthReturnPath = oauthReturnParams.toString() ? `/login?${oauthReturnParams.toString()}` : '/login';
  const registerParams = new URLSearchParams();
  if (inviteToken) registerParams.set('invite', inviteToken);
  if (nextPath) registerParams.set('next', nextPath);
  const registerPath = registerParams.toString() ? `/register?${registerParams.toString()}` : '/register';
  const isInviteFlow = Boolean(inviteToken);
  const resolveDefaultPostAuthPath = useCallback(() => {
    const { portal, user } = useAuthStore.getState();
    if (isBusinessPortalActive(user, portal)) return '/my-venue';
    return '/';
  }, []);

  const resolvePostAuthPath = useCallback(
    () => (inviteToken ? `/invite/${inviteToken}` : nextPath ?? resolveDefaultPostAuthPath()),
    [inviteToken, nextPath, resolveDefaultPostAuthPath],
  );

  useEffect(() => {
    const oauthError = getOAuthCallbackErrorMessage(location.search);
    if (!oauthError) return;

    setError(t(oauthError));
    setIsLoading(false);
    window.history.replaceState(null, '', oauthReturnPath);
  }, [location.search, oauthReturnPath, t]);

  useEffect(() => {
    const oauthHash = location.hash;
    const hasOAuthPayload = oauthHash.includes('access_token') || oauthHash.includes('refresh_token');
    if (!hasOAuthPayload) return;

    let isActive = true;
    setError('');
    setIsLoading(true);
    window.history.replaceState(null, '', `${location.pathname}${location.search}`);

    void (async () => {
      try {
        const success = await completeGoogleAuth(oauthHash);
        if (!success) return;
        navigate(resolvePostAuthPath());
      } catch (err) {
        const message = err instanceof Error ? t(err.message) : t('Произошла ошибка при входе');
        if (isActive) setError(message);
      } finally {
        if (isActive) setIsLoading(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [completeGoogleAuth, location.hash, location.pathname, location.search, navigate, resolvePostAuthPath, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login({ email, password });
      if (success) {
        navigate(resolvePostAuthPath());
      } else {
        setError(t('Неверный email или пароль'));
      }
    } catch (err) {
      const message = err instanceof Error ? t(err.message) : t('Произошла ошибка при входе');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Ambient copper glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/[0.04] rounded-full blur-[120px] animate-glow-pulse" />
      </div>
      <div className="absolute right-4 top-4 z-20">
        <PreferenceControls />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-up">
        {/* Heading above card */}
        <div className="text-center mb-8">
          <img
            src="/favicon.svg"
            alt=""
            aria-hidden="true"
            className="mx-auto mb-5 h-12 w-12 rounded-xl shadow-glow"
          />
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            {t('Вход пользователя')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('Войдите, чтобы бронировать места и управлять своими бронями')}
          </p>
        </div>

        <Card className="border-border/40 shadow-xl shadow-black/20">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5 pt-6">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full border-border/60 bg-secondary/40"
                onClick={() => startGoogleAuth(oauthReturnPath)}
                disabled={isLoading}
              >
                {t('Продолжить с Google')}
              </Button>

              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-muted-foreground/70">
                <span className="h-px flex-1 bg-border/60" />
                <span>{t('или через email')}</span>
                <span className="h-px flex-1 bg-border/60" />
              </div>

              {error && (
                <Alert variant="destructive" className="animate-scale-in">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-muted-foreground">{t('Email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t('Например: your@email.com')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-muted-foreground">{t('Пароль')}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pt-2 pb-6">
              <Button type="submit" className="w-full h-11 font-medium text-sm tracking-wide" disabled={isLoading}>
                {isLoading ? t('Вход...') : t('Войти')}
              </Button>
              {isInviteFlow ? (
                <p className="text-sm text-center text-muted-foreground">
                  {t('Нет аккаунта?')}{' '}
                  <Link to={registerPath} className="text-primary hover:text-primary/80 transition-colors">
                    {t('Зарегистрироваться')}
                  </Link>
                </p>
              ) : (
                <p className="text-sm text-center text-muted-foreground">
                  {t('Нет аккаунта?')}{' '}
                  <Link to={registerPath} className="text-primary hover:text-primary/80 transition-colors">
                    {t('Зарегистрироваться')}
                  </Link>
                </p>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
