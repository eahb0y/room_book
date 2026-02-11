import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { AlertCircle, UserPlus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { UserRole } from '@/types';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const register = useAuthStore((state) => state.register);
  const inviteToken = new URLSearchParams(location.search).get('invite');
  const pendingInvite = inviteToken || sessionStorage.getItem('pendingInviteToken');
  const isInviteFlow = Boolean(pendingInvite);
  const role: UserRole = isInviteFlow ? 'user' : 'admin';

  useEffect(() => {
    if (inviteToken) {
      sessionStorage.setItem('pendingInviteToken', inviteToken);
    }
  }, [inviteToken]);

  if (isInviteFlow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/[0.04] rounded-full blur-[120px] animate-glow-pulse" />
        </div>

        <div className="w-full max-w-md relative z-10 animate-fade-up">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/90 mb-5 shadow-glow">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-semibold text-foreground mb-2">
              Регистрация недоступна
            </h1>
            <p className="text-muted-foreground text-sm">
              Приглашение работает только для существующих аккаунтов.
            </p>
          </div>

          <Card className="border-border/40 shadow-xl shadow-black/20">
            <CardContent className="space-y-5 pt-6">
              <p className="text-sm text-muted-foreground">
                Войдите в систему, чтобы принять приглашение. Если у вас нет аккаунта,
                обратитесь к администратору.
              </p>
              <Button
                className="w-full h-11 font-medium text-sm tracking-wide"
                onClick={() => navigate(`/login?invite=${pendingInvite}`)}
              >
                Перейти ко входу
              </Button>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pb-6">
              <p className="text-sm text-center text-muted-foreground">
                Уже входили ранее?{' '}
                <Link to={`/login?invite=${pendingInvite}`} className="text-primary hover:text-primary/80 transition-colors">
                  Войти
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    setIsLoading(true);

    try {
      const success = await register({ email, password, role });
      if (success) {
        if (pendingInvite) {
          sessionStorage.setItem('pendingInviteToken', pendingInvite);
          navigate(`/invite/${pendingInvite}`);
        } else {
          navigate('/app');
        }
      } else {
        setError('Пользователь с таким email уже существует');
      }
    } catch {
      setError('Произошла ошибка при регистрации');
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

      <div className="w-full max-w-md relative z-10 animate-fade-up">
        {/* Heading */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/90 mb-5 shadow-glow">
            <UserPlus className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            {isInviteFlow ? 'Регистрация по приглашению' : 'Регистрация бизнеса'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isInviteFlow
              ? 'Создайте аккаунт, чтобы принять приглашение'
              : 'Создайте бизнес-аккаунт для работы с платформой'}
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
                <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm text-muted-foreground">Пароль</Label>
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
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm text-muted-foreground">Подтвердите пароль</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-11 bg-input/50 border-border/50 focus:border-primary/60 transition-colors"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pb-6">
              <Button type="submit" className="w-full h-11 font-medium text-sm tracking-wide" disabled={isLoading}>
                {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                Уже есть аккаунт?{' '}
                <Link to="/login" className="text-primary hover:text-primary/80 transition-colors">
                  Войти
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
