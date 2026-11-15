import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import type { VerifiedActor, AdminRole } from './adminControls';

const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));

export const MASTER_ADMIN_EMAIL = 'evaristopaulocassoma00@gmail.com';

interface CachedTokenInfo {
  actor: VerifiedActor;
  firestoreBalanceCents: number;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedTokenInfo>();

export interface AuthenticatedRequest extends Request {
  actor?: VerifiedActor;
  idToken?: string;
  firestoreBalanceCents?: number;
}

async function lookupFirebaseUser(idToken: string): Promise<{
  uid: string;
  email: string;
  emailVerified: boolean;
}> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!resp.ok) {
    throw new Error('Token Firebase inválido ou expirado.');
  }
  const data = (await resp.json()) as any;
  const user = data?.users?.[0];
  if (!user || !user.localId) {
    throw new Error('Utilizador Firebase não encontrado.');
  }
  return {
    uid: user.localId,
    email: user.email || '',
    emailVerified: Boolean(user.emailVerified),
  };
}

async function fetchFirestoreUserDoc(idToken: string, uid: string): Promise<{
  isAdmin: boolean;
  roleField: string | null;
  balanceCents: number;
}> {
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/users/${uid}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!resp.ok) {
    return { isAdmin: false, roleField: null, balanceCents: 0 };
  }
  const doc = (await resp.json()) as any;
  const fields = doc?.fields || {};
  const isAdmin = Boolean(fields.is_admin?.booleanValue);
  const roleField = fields.role?.stringValue || null;
  const balanceRaw =
    fields.balance?.doubleValue !== undefined
      ? Number(fields.balance.doubleValue)
      : fields.balance?.integerValue !== undefined
        ? Number(fields.balance.integerValue)
        : 0;
  return {
    isAdmin,
    roleField,
    balanceCents: Math.max(0, Math.round(balanceRaw * 100)),
  };
}

export async function verifyFirebaseRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Autenticação obrigatória (Bearer token em falta).' });
      return;
    }

    const idToken = authHeader.slice(7).trim();
    if (!idToken) {
      res.status(401).json({ error: 'Token de autenticação vazio.' });
      return;
    }

    const now = Date.now();
    const cached = tokenCache.get(idToken);
    if (cached && cached.expiresAt > now) {
      req.actor = { ...cached.actor, ip: req.ip };
      req.idToken = idToken;
      req.firestoreBalanceCents = cached.firestoreBalanceCents;
      next();
      return;
    }

    const fbUser = await lookupFirebaseUser(idToken);
    const fsDoc = await fetchFirestoreUserDoc(idToken, fbUser.uid);

    let role: AdminRole = 'USER';
    if (fbUser.email.toLowerCase() === MASTER_ADMIN_EMAIL && fbUser.emailVerified) {
      role = 'MASTER_ADMIN';
    } else if (fsDoc.isAdmin || fsDoc.roleField === 'admin' || fsDoc.roleField === 'operational_admin') {
      role = 'OPERATIONAL_ADMIN';
    }

    const actor: VerifiedActor = {
      uid: fbUser.uid,
      email: fbUser.email,
      role,
      ip: req.ip,
    };

    tokenCache.set(idToken, {
      actor,
      firestoreBalanceCents: fsDoc.balanceCents,
      expiresAt: now + 15_000, // 15s cache
    });

    req.actor = actor;
    req.idToken = idToken;
    req.firestoreBalanceCents = fsDoc.balanceCents;
    next();
  } catch (err: any) {
    res.status(401).json({ error: err?.message || 'Falha na verificação de sessão.' });
  }
}

export async function optionalFirebaseRequest(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }
    const idToken = authHeader.slice(7).trim();
    if (!idToken) {
      next();
      return;
    }
    const now = Date.now();
    const cached = tokenCache.get(idToken);
    if (cached && cached.expiresAt > now) {
      req.actor = { ...cached.actor, ip: req.ip };
      req.idToken = idToken;
      req.firestoreBalanceCents = cached.firestoreBalanceCents;
      next();
      return;
    }
    const fbUser = await lookupFirebaseUser(idToken);
    req.actor = { uid: fbUser.uid, email: fbUser.email, role: 'USER', ip: req.ip };
    req.idToken = idToken;
  } catch {
    // Optional auth ignores invalid tokens cleanly
  }
  next();
}

export function requireAdminMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.actor || (req.actor.role !== 'MASTER_ADMIN' && req.actor.role !== 'OPERATIONAL_ADMIN')) {
    res.status(403).json({ error: 'Acesso restrito a administradores autorizados.' });
    return;
  }
  next();
}

export function requireMasterAdminMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.actor || req.actor.role !== 'MASTER_ADMIN') {
    res.status(403).json({ error: 'Ação exclusiva do Master Admin.' });
    return;
  }
  next();
}

// Sliding window rate limiter per user/IP
const rateBuckets = new Map<string, number[]>();

export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const key = `${req.actor?.uid || req.ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const list = (rateBuckets.get(key) || []).filter(ts => ts > now - windowMs);
    if (list.length >= maxRequests) {
      res.status(429).json({
        error: 'Limite de taxa excedido (Rate Limiting). Aguarde alguns segundos antes de tentar novamente.',
      });
      return;
    }
    list.push(now);
    rateBuckets.set(key, list);
    next();
  };
}
