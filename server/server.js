import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'db.json');
const PORT = process.env.PORT ? Number(process.env.PORT) : 5174;

const ensureDb = async () => {
  try {
    await readFile(DB_PATH, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      await writeFile(DB_PATH, JSON.stringify({ invitations: [] }, null, 2));
      return;
    }
    throw err;
  }
};

const readDb = async () => {
  await ensureDb();
  const raw = await readFile(DB_PATH, 'utf8');
  return JSON.parse(raw);
};

const writeDb = async (db) => {
  await writeFile(DB_PATH, JSON.stringify(db, null, 2));
};

const sendJson = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  if (body === undefined) {
    res.end();
    return;
  }
  res.end(JSON.stringify(body));
};

const parseBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return null;
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return null;
  return JSON.parse(raw);
};

const generateToken = () => {
  if (crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return crypto.randomBytes(24).toString('hex');
};

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeEmail = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

const isInvitationValid = (invitation) => {
  if (invitation.revokedAt) return false;
  if (invitation.expiresAt && new Date(invitation.expiresAt) <= new Date()) return false;
  if (invitation.maxUses !== undefined && invitation.uses >= invitation.maxUses) return false;
  return true;
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const { pathname, searchParams } = url;

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/invitations') {
      const venueId = searchParams.get('venueId');
      const db = await readDb();
      const invitations = venueId
        ? db.invitations.filter((inv) => inv.venueId === venueId)
        : db.invitations;
      sendJson(res, 200, { invitations });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/invitations') {
      const body = await parseBody(req);
      const venueId = body?.venueId;
      const venueName = body?.venueName;
      const createdByUserId = body?.createdByUserId;
      const inviteeFirstName = toTrimmedString(body?.inviteeFirstName);
      const inviteeLastName = toTrimmedString(body?.inviteeLastName);
      const inviteeEmail = normalizeEmail(body?.inviteeEmail);
      const inviteeUserId = toTrimmedString(body?.inviteeUserId);

      if (!venueId || !venueName || !createdByUserId || !inviteeFirstName || !inviteeLastName || !inviteeEmail) {
        sendJson(res, 400, { error: 'venueId, venueName, createdByUserId, inviteeFirstName, inviteeLastName, inviteeEmail are required' });
        return;
      }

      const db = await readDb();
      const invitation = {
        id: `${venueId}-invite-${Date.now()}`,
        venueId,
        venueName,
        token: generateToken(),
        createdByUserId,
        inviteeUserId: inviteeUserId || undefined,
        inviteeFirstName,
        inviteeLastName,
        inviteeEmail,
        createdAt: new Date().toISOString(),
        expiresAt: body?.expiresAt,
        maxUses: body?.maxUses ?? 1,
        uses: 0,
        status: 'pending',
      };
      db.invitations.push(invitation);
      await writeDb(db);
      sendJson(res, 201, { invitation });
      return;
    }

    const tokenMatch = pathname.match(/^\/api\/invitations\/by-token\/([^/]+)$/);
    if (req.method === 'GET' && tokenMatch) {
      const token = decodeURIComponent(tokenMatch[1]);
      const db = await readDb();
      const invitation = db.invitations.find((inv) => inv.token === token);
      if (!invitation) {
        sendJson(res, 404, { error: 'Приглашение не найдено' });
        return;
      }
      sendJson(res, 200, { invitation });
      return;
    }

    const redeemMatch = pathname.match(/^\/api\/invitations\/by-token\/([^/]+)\/redeem$/);
    if (req.method === 'POST' && redeemMatch) {
      const token = decodeURIComponent(redeemMatch[1]);
      const body = await parseBody(req);
      const userId = body?.userId;
      const userEmail = normalizeEmail(body?.userEmail);
      if (!userId) {
        sendJson(res, 400, { error: 'userId is required' });
        return;
      }

      const db = await readDb();
      const invitation = db.invitations.find((inv) => inv.token === token);
      if (!invitation) {
        sendJson(res, 404, { error: 'Приглашение не найдено или удалено' });
        return;
      }
      if (invitation.inviteeUserId && invitation.inviteeUserId !== userId) {
        sendJson(res, 400, { error: 'Приглашение предназначено для другого пользователя' });
        return;
      }
      if (invitation.status === 'connected') {
        if (invitation.connectedUserId === userId) {
          sendJson(res, 200, { success: true, venueId: invitation.venueId, invitationId: invitation.id });
          return;
        }
        sendJson(res, 400, { error: 'Приглашение уже использовано' });
        return;
      }
      if (invitation.inviteeEmail && userEmail && invitation.inviteeEmail !== userEmail) {
        sendJson(res, 400, { error: 'Приглашение предназначено для другого email' });
        return;
      }
      if (!isInvitationValid(invitation)) {
        sendJson(res, 400, { error: 'Приглашение недействительно' });
        return;
      }

      invitation.uses += 1;
      invitation.status = 'connected';
      invitation.connectedAt = new Date().toISOString();
      invitation.connectedUserId = userId;
      await writeDb(db);
      sendJson(res, 200, { success: true, venueId: invitation.venueId, invitationId: invitation.id });
      return;
    }

    const updateMatch = pathname.match(/^\/api\/invitations\/([^/]+)$/);
    if (req.method === 'PATCH' && updateMatch) {
      const id = decodeURIComponent(updateMatch[1]);
      const body = await parseBody(req);
      const db = await readDb();
      const invitation = db.invitations.find((inv) => inv.id === id);
      if (!invitation) {
        sendJson(res, 404, { error: 'Приглашение не найдено' });
        return;
      }

      if ('expiresAt' in (body ?? {})) {
        invitation.expiresAt = body.expiresAt || undefined;
      }
      if ('maxUses' in (body ?? {})) {
        invitation.maxUses = body.maxUses ?? undefined;
      }

      await writeDb(db);
      sendJson(res, 200, { invitation });
      return;
    }

    const revokeMatch = pathname.match(/^\/api\/invitations\/([^/]+)\/revoke$/);
    if (req.method === 'POST' && revokeMatch) {
      const id = decodeURIComponent(revokeMatch[1]);
      const db = await readDb();
      const invitation = db.invitations.find((inv) => inv.id === id);
      if (!invitation) {
        sendJson(res, 404, { error: 'Приглашение не найдено' });
        return;
      }
      invitation.revokedAt = new Date().toISOString();
      await writeDb(db);
      sendJson(res, 200, { invitation });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    sendJson(res, 500, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`Invite API running on http://localhost:${PORT}`);
});
