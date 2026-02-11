import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useVenueStore } from '@/store/venueStore';
import { getInvitationByToken, redeemInvitation } from '@/lib/inviteApi';
import type { Invitation } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Ticket } from 'lucide-react';

const INVITE_STORAGE_KEY = 'pendingInviteToken';

export default function Invite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const addMembership = useVenueStore((state) => state.addMembership);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLoadError, setInviteLoadError] = useState('');

  const [redeemState, setRedeemState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const redeemAttemptRef = useRef<string | null>(null);

  const invitationStatus = useMemo(() => {
    if (!invitation) return 'missing';
    if (invitation.revokedAt) return 'revoked';
    if (invitation.expiresAt && new Date(invitation.expiresAt) <= new Date()) return 'expired';
    if (invitation.maxUses !== undefined && invitation.uses >= invitation.maxUses) return 'used';
    return 'valid';
  }, [invitation]);

  const inviteSubtitle = useMemo(() => {
    if (inviteLoading) return 'Проверяем приглашение…';
    if (invitation?.venueName) return `Вы приглашены в «${invitation.venueName}»`;
    return 'Приглашение';
  }, [inviteLoading, invitation?.venueName]);

  useEffect(() => {
    if (!token) return;
    if (!isAuthenticated) {
      sessionStorage.setItem(INVITE_STORAGE_KEY, token);
    }
  }, [token, isAuthenticated]);

  useEffect(() => {
    if (!token) return;
    redeemAttemptRef.current = null;
    setRedeemState('idle');
    setError('');
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let isActive = true;
    setInviteLoading(true);
    setInviteLoadError('');
    setInvitation(null);

    getInvitationByToken(token)
      .then((data) => {
        if (!isActive) return;
        setInvitation(data);
      })
      .catch((err) => {
        if (!isActive) return;
        const message = err instanceof Error ? err.message : 'Не удалось проверить приглашение';
        const lower = message.toLowerCase();
        if (lower.includes('not found') || lower.includes('не найдено')) {
          setInviteLoadError('');
        } else {
          setInviteLoadError(message);
        }
        setInvitation(null);
      })
      .finally(() => {
        if (!isActive) return;
        setInviteLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !isAuthenticated || !user) return;
    if (user.role === 'admin') return;
    if (inviteLoading || inviteLoadError) return;
    if (invitationStatus !== 'valid') return;
    if (redeemState !== 'idle') return;

    const redeemKey = `${token}:${user.id}`;
    if (redeemAttemptRef.current === redeemKey) return;
    redeemAttemptRef.current = redeemKey;

    setRedeemState('loading');
    redeemInvitation(token, user.id, user.email)
      .then((result) => {
        if (result.success && result.venueId) {
          sessionStorage.removeItem(INVITE_STORAGE_KEY);
          addMembership(result.venueId, user.id, result.invitationId);
          navigate(`/venue/${result.venueId}`);
        } else {
          setError('Не удалось применить приглашение');
          setRedeemState('error');
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Не удалось применить приглашение';
        setError(message);
        setRedeemState('error');
      });
  }, [token, isAuthenticated, user, inviteLoading, inviteLoadError, invitationStatus, redeemState, addMembership, navigate]);

  const handleContinue = () => {
    if (!token) return;
    sessionStorage.setItem(INVITE_STORAGE_KEY, token);
    navigate(`/login?invite=${token}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/[0.04] rounded-full blur-[120px] animate-glow-pulse" />
      </div>

      <div className="w-full max-w-lg relative z-10 animate-fade-up">
        {/* Heading */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/90 mb-5 shadow-glow">
            <Ticket className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground mb-2">
            Приглашение
          </h1>
          <p className="text-muted-foreground text-sm">
            {inviteSubtitle}
          </p>
        </div>

        <Card className="border-border/40 shadow-xl shadow-black/20">
          <CardContent className="space-y-4 pt-6 pb-6">
            {inviteLoadError && (
              <Alert variant="destructive" className="animate-scale-in">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{inviteLoadError}</AlertDescription>
              </Alert>
            )}

            {!inviteLoading && !inviteLoadError && invitationStatus !== 'valid' && (
              <Alert variant="destructive" className="animate-scale-in">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {invitationStatus === 'missing'
                    ? 'Приглашение не найдено'
                    : invitationStatus === 'revoked'
                    ? 'Приглашение было отозвано'
                    : invitationStatus === 'expired'
                    ? 'Срок действия приглашения истёк'
                    : 'Лимит использования приглашения исчерпан'}
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive" className="animate-scale-in">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {invitationStatus === 'valid' && isAuthenticated && user?.role !== 'admin' && (
              <Alert className="bg-emerald-950/30 border-emerald-800/40 animate-scale-in">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <AlertDescription className="text-emerald-300">
                  Приглашение подтверждено, перенаправляем…
                </AlertDescription>
              </Alert>
            )}

            {invitationStatus === 'valid' && !isAuthenticated && (
              <>
                <p className="text-sm text-muted-foreground">
                  Приглашение доступно только для существующих аккаунтов. Войдите в систему.
                </p>
                <div className="flex flex-col gap-3">
                  <Button onClick={handleContinue} className="h-11">Войти</Button>
                </div>
              </>
            )}

            {isAuthenticated && user?.role === 'admin' && (
              <Alert variant="destructive" className="animate-scale-in">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Администраторские аккаунты не могут принимать приглашения.
                </AlertDescription>
              </Alert>
            )}

            <div className="pt-2">
              <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                ← Вернуться на главную
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
