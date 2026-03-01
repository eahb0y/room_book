create or replace function public.preview_invitation_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invitation public.invitations%rowtype;
  normalized_token text := lower(trim(coalesce(p_token, '')));
begin
  if normalized_token = '' then
    raise exception 'Приглашение не найдено';
  end if;

  select i.*
  into target_invitation
  from public.invitations i
  where i.token = normalized_token
  limit 1;

  if not found then
    raise exception 'Приглашение не найдено';
  end if;

  return jsonb_build_object(
    'id', target_invitation.id,
    'venueId', target_invitation.venue_id,
    'venueName', target_invitation.venue_name,
    'token', target_invitation.token,
    'createdAt', target_invitation.created_at,
    'expiresAt', target_invitation.expires_at,
    'maxUses', target_invitation.max_uses,
    'uses', target_invitation.uses,
    'revokedAt', target_invitation.revoked_at,
    'status', target_invitation.status,
    'connectedAt', target_invitation.connected_at,
    'connectedUserId', target_invitation.connected_user_id
  );
end;
$$;

revoke all on function public.preview_invitation_by_token(text) from public;
grant execute on function public.preview_invitation_by_token(text) to anon, authenticated;
