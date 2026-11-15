import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;

function encodeValue(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return { integerValue: String(v) };
    return { doubleValue: v };
  }
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(encodeValue) } };
  }
  if (typeof v === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) {
      fields[k] = encodeValue(val);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function encodeFields(payload: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v !== undefined) {
      fields[k] = encodeValue(v);
    }
  }
  return fields;
}

function decodeValue(val: any): any {
  if (!val || typeof val !== 'object') return null;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('stringValue' in val) return String(val.stringValue);
  if ('timestampValue' in val) return String(val.timestampValue);
  if ('arrayValue' in val) {
    return (val.arrayValue?.values || []).map(decodeValue);
  }
  if ('mapValue' in val) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue?.fields || {})) {
      out[k] = decodeValue(v);
    }
    return out;
  }
  return null;
}

export async function fetchFirestoreDoc(
  idToken: string,
  collectionName: string,
  docId: string
): Promise<Record<string, any> | null> {
  const resp = await fetch(`${FIRESTORE_BASE}/${collectionName}/${encodeURIComponent(docId)}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (resp.status === 404) return null;
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Erro ao consultar ${collectionName}/${docId}: ${txt}`);
  }
  const doc = (await resp.json()) as any;
  const out: Record<string, any> = { id: docId };
  for (const [k, v] of Object.entries(doc?.fields || {})) {
    out[k] = decodeValue(v);
  }
  return out;
}

export async function patchFirestoreFields(
  idToken: string,
  collectionName: string,
  docId: string,
  payload: Record<string, any>,
  throwOnError: boolean = false
): Promise<void> {
  const keys = Object.keys(payload).filter((k) => payload[k] !== undefined);
  if (keys.length === 0) return;
  const mask = keys.map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const resp = await fetch(`${FIRESTORE_BASE}/${collectionName}/${encodeURIComponent(docId)}?${mask}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: encodeFields(payload) }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    if (throwOnError) {
      throw new Error(`Firestore PATCH ${collectionName}/${docId} falhou: ${errText}`);
    }
    console.warn(`Firestore PATCH warning (${collectionName}/${docId}):`, errText);
  }
}

export async function createFirestoreDoc(
  idToken: string,
  collectionName: string,
  payload: Record<string, any>,
  customDocId?: string,
  throwOnError: boolean = false
): Promise<string> {
  const docId = customDocId || randomUUID();
  const fullPayload = { id: docId, ...payload };
  const resp = await fetch(`${FIRESTORE_BASE}/${collectionName}?documentId=${encodeURIComponent(docId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: encodeFields(fullPayload) }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    if (throwOnError) {
      throw new Error(`Firestore CREATE ${collectionName}/${docId} falhou: ${errText}`);
    }
    console.warn(`Firestore CREATE warning (${collectionName}/${docId}):`, errText);
  }
  return docId;
}

export async function deleteFirestoreDoc(
  idToken: string,
  collectionName: string,
  docId: string
): Promise<void> {
  try {
    await fetch(`${FIRESTORE_BASE}/${collectionName}/${encodeURIComponent(docId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    });
  } catch (e) {
    console.warn(`Firestore DELETE warning (${collectionName}/${docId}):`, e);
  }
}

export async function getFreshFirestoreBalanceCents(idToken: string, uid: string): Promise<number> {
  const resp = await fetch(`${FIRESTORE_BASE}/users/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!resp.ok) {
    throw new Error('Não foi possível consultar o saldo do utilizador no Firestore.');
  }
  const doc = (await resp.json()) as any;
  const fields = doc?.fields || {};
  const bal =
    fields.balance?.doubleValue !== undefined
      ? Number(fields.balance.doubleValue)
      : fields.balance?.integerValue !== undefined
        ? Number(fields.balance.integerValue)
        : 0;
  return Math.max(0, Math.round(bal * 100));
}

export async function updateFirestoreUserBalanceCents(
  idToken: string,
  uid: string,
  newBalanceCents: number
): Promise<void> {
  const balanceKz = Number((newBalanceCents / 100).toFixed(2));
  await patchFirestoreFields(idToken, 'users', uid, { balance: balanceKz }, false);
}

export async function recordFirestoreLedgerEntry(
  idToken: string,
  params: {
    userId: string;
    type: string;
    amountKz: number;
    balanceBeforeKz: number;
    balanceAfterKz: number;
    reference: string;
  }
): Promise<void> {
  try {
    await createFirestoreDoc(idToken, 'ledger', {
      user_id: params.userId,
      type: params.type,
      amount: Number(params.amountKz.toFixed(2)),
      balanceBefore: Number(params.balanceBeforeKz.toFixed(2)),
      balanceAfter: Number(params.balanceAfterKz.toFixed(2)),
      reference: params.reference,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Firestore ledger sync warning:', e);
  }
}

export async function mirrorAmmStateToFirestore(
  idToken: string,
  collectionName: string,
  docId: string,
  payload: Record<string, string | number | boolean | null>
): Promise<void> {
  try {
    await patchFirestoreFields(idToken, collectionName, docId, payload, false);
  } catch (e) {
    console.warn(`Firestore mirror (${collectionName}/${docId}) warning:`, e);
  }
}

export async function syncUserPositionToFirestore(
  idToken: string,
  uid: string,
  marketId: string,
  positionRows: Array<{ outcome: 'Yes' | 'No'; available_shares: number; reserved_shares: number; avg_price_cents: number }>
): Promise<void> {
  // Clean up legacy single-doc ID if it exists
  await deleteFirestoreDoc(idToken, 'positions', `${uid}_${marketId}`);

  for (const outcome of ['Yes', 'No'] as const) {
    const posDocId = `${uid}_${marketId}_${outcome}`;
    const row = positionRows.find((r) => r.outcome === outcome);
    const totalShares = (row?.available_shares || 0) + (row?.reserved_shares || 0);
    if (totalShares <= 0) {
      await deleteFirestoreDoc(idToken, 'positions', posDocId);
    } else {
      await patchFirestoreFields(
        idToken,
        'positions',
        posDocId,
        {
          id: posDocId,
          userId: uid,
          user_id: uid,
          marketId,
          market_id: marketId,
          outcome,
          shares: totalShares,
          available_shares: row?.available_shares || 0,
          reserved_shares: row?.reserved_shares || 0,
          avg_price: Number(((row?.avg_price_cents || 0) / 100).toFixed(2)),
          updated_at: new Date().toISOString(),
        },
        false
      );
    }
  }
}

export async function syncClobTradeToFirestore(
  idToken: string,
  params: {
    marketId: string;
    side: 'Buy' | 'Sell';
    outcome: 'Yes' | 'No';
    uid: string;
    filledQuantity: number;
    avgExecutionPriceCents: number | null;
    yesPriceCents: number;
    noPriceCents: number;
    executions: Array<{ executionId: string; notionalCents: number; feeCents: number; priceCents: number; quantity: number }>;
    positionRows: Array<{ outcome: 'Yes' | 'No'; available_shares: number; reserved_shares: number; avg_price_cents: number }>;
  }
): Promise<void> {
  const {
    marketId,
    side,
    outcome,
    uid,
    filledQuantity,
    avgExecutionPriceCents,
    yesPriceCents,
    noPriceCents,
    executions,
    positionRows,
  } = params;

  const totalNotionalCents = executions.reduce((s, e) => s + e.notionalCents, 0);
  const totalFeeCents = executions.reduce((s, e) => s + e.feeCents, 0);
  const volumeAddedKz = Number((totalNotionalCents / 100).toFixed(2));
  const now = new Date().toISOString();

  // Sync market prices and volume
  if (filledQuantity > 0) {
    let currentVol = 0;
    try {
      const mDoc = await fetchFirestoreDoc(idToken, 'markets', marketId);
      currentVol = Number(mDoc?.volume || 0);
    } catch {
      currentVol = 0;
    }

    const yesPrice = Number((yesPriceCents / 100).toFixed(2));
    const noPrice = Number((noPriceCents / 100).toFixed(2));

    await patchFirestoreFields(
      idToken,
      'markets',
      marketId,
      {
        yes_price: yesPrice,
        no_price: noPrice,
        volume: Number((currentVol + volumeAddedKz).toFixed(2)),
      },
      false
    );

    await createFirestoreDoc(idToken, 'trades', {
      market_id: marketId,
      user_id: uid,
      side,
      outcome,
      amount: volumeAddedKz,
      shares: filledQuantity,
      price: Number(((avgExecutionPriceCents || (outcome === 'Yes' ? yesPriceCents : noPriceCents)) / 100).toFixed(2)),
      fee: Number((totalFeeCents / 100).toFixed(2)),
      engine: 'CLOB_AMM',
      timestamp: now,
    });

    await createFirestoreDoc(idToken, 'price_history', {
      market_id: marketId,
      yes_price: yesPrice,
      no_price: noPrice,
      timestamp: now,
    });
  }

  await syncUserPositionToFirestore(idToken, uid, marketId, positionRows);
}

export async function syncMarketSettlementToFirestore(
  idToken: string,
  params: {
    marketId: string;
    winningOutcome: 'Yes' | 'No';
    motive: string;
    resolvedBy: string;
    settledUsers: Array<{
      userId: string;
      payoutCents: number;
      refundCents: number;
      losingShares: number;
      newAvailableCents: number;
    }>;
  }
): Promise<void> {
  const { marketId, winningOutcome, motive, resolvedBy, settledUsers } = params;
  const now = new Date().toISOString();

  await patchFirestoreFields(
    idToken,
    'markets',
    marketId,
    {
      resolved: true,
      resolution_outcome: winningOutcome,
      status: 'resolved',
      resolved_at: now,
      resolution_motive: motive,
      resolved_by: resolvedBy,
    },
    true
  );

  await createFirestoreDoc(idToken, 'audit_logs', {
    action: 'MARKET_RESOLUTION',
    admin_id: resolvedBy,
    details: `Admin ${resolvedBy} resolveu o mercado "${marketId}" no CLOB+AMM como "${winningOutcome}". Motivo: ${motive}`,
    created_at: now,
    timestamp: now,
  });

  for (const u of settledUsers) {
    if (u.userId.startsWith('bot_') || u.userId === 'AMM_MERCADOAO_COMPANY') {
      await deleteFirestoreDoc(idToken, 'positions', `${u.userId}_${marketId}_Yes`);
      await deleteFirestoreDoc(idToken, 'positions', `${u.userId}_${marketId}_No`);
      await deleteFirestoreDoc(idToken, 'positions', `${u.userId}_${marketId}`);
      continue;
    }

    const newBalanceKz = Number((u.newAvailableCents / 100).toFixed(2));
    await patchFirestoreFields(idToken, 'users', u.userId, { balance: newBalanceKz }, false);

    if (u.payoutCents > 0) {
      const payoutKz = Number((u.payoutCents / 100).toFixed(2));
      const beforeKz = Number(Math.max(0, newBalanceKz - payoutKz).toFixed(2));
      await recordFirestoreLedgerEntry(idToken, {
        userId: u.userId,
        type: 'PREMIACAO_MERCADO',
        amountKz: payoutKz,
        balanceBeforeKz: beforeKz,
        balanceAfterKz: newBalanceKz,
        reference: marketId,
      });

      await createFirestoreDoc(idToken, 'audit_logs', {
        action: 'WINNER_PAYOUT',
        details: `Pago ${payoutKz.toFixed(2)} KZ para utilizador ${u.userId} no mercado ${marketId} (Motor CLOB+AMM).`,
        created_at: now,
        timestamp: now,
      });
    }

    await deleteFirestoreDoc(idToken, 'positions', `${u.userId}_${marketId}_Yes`);
    await deleteFirestoreDoc(idToken, 'positions', `${u.userId}_${marketId}_No`);
    await deleteFirestoreDoc(idToken, 'positions', `${u.userId}_${marketId}`);
  }
}

export async function syncFinanceProcessToFirestore(
  idToken: string,
  params: {
    requestId: string;
    status: 'approved' | 'rejected';
    adminUid: string;
    userId: string;
    type: 'deposit' | 'withdrawal';
    amountCents: number;
    beforeCents: number;
    afterCents: number;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const { requestId, status, adminUid, userId, type, amountCents, beforeCents, afterCents } = params;

  await patchFirestoreFields(
    idToken,
    'finance_requests',
    requestId,
    {
      status,
      processed_at: now,
      processed_by: adminUid,
    },
    true
  );

  const amountKz = Number((amountCents / 100).toFixed(2));
  const beforeKz = Number((beforeCents / 100).toFixed(2));
  const afterKz = Number((afterCents / 100).toFixed(2));

  if (status === 'approved') {
    await patchFirestoreFields(idToken, 'users', userId, { balance: afterKz }, true);
    await recordFirestoreLedgerEntry(idToken, {
      userId,
      type: type === 'deposit' ? 'DEPOSITO' : 'SAQUE',
      amountKz: type === 'deposit' ? amountKz : -amountKz,
      balanceBeforeKz: beforeKz,
      balanceAfterKz: afterKz,
      reference: requestId,
    });
    await createFirestoreDoc(idToken, 'audit_logs', {
      action: type === 'deposit' ? 'DEPOSIT_APPROVED' : 'WITHDRAWAL_APPROVED',
      admin_id: adminUid,
      details: `Admin ${adminUid} aprovou ${type === 'deposit' ? 'depósito' : 'saque'} de ${amountKz} KZ para ${userId}. Saldo: ${beforeKz} KZ -> ${afterKz} KZ.`,
      created_at: now,
      timestamp: now,
    });
  } else {
    await createFirestoreDoc(idToken, 'audit_logs', {
      action: type === 'deposit' ? 'DEPOSIT_REJECTED' : 'WITHDRAWAL_REJECTED',
      admin_id: adminUid,
      details: `Admin ${adminUid} rejeitou ${type === 'deposit' ? 'depósito' : 'saque'} de ${amountKz} KZ para ${userId}.`,
      created_at: now,
      timestamp: now,
    });
  }
}

export async function syncAdminBalanceToFirestore(
  idToken: string,
  params: {
    userId: string;
    beforeCents: number;
    afterCents: number;
    adminUid: string;
    reason: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const beforeKz = Number((params.beforeCents / 100).toFixed(2));
  const afterKz = Number((params.afterCents / 100).toFixed(2));
  const deltaKz = Number((afterKz - beforeKz).toFixed(2));

  await patchFirestoreFields(idToken, 'users', params.userId, { balance: afterKz }, true);
  await recordFirestoreLedgerEntry(idToken, {
    userId: params.userId,
    type: 'AJUSTE_ADMIN',
    amountKz: deltaKz,
    balanceBeforeKz: beforeKz,
    balanceAfterKz: afterKz,
    reference: `ADMIN:${params.adminUid}`,
  });
  await createFirestoreDoc(idToken, 'audit_logs', {
    action: 'ADMIN_BALANCE_ADJUST',
    admin_id: params.adminUid,
    details: `Admin ${params.adminUid} ajustou saldo de ${params.userId}: ${beforeKz} KZ -> ${afterKz} KZ. Motivo: ${params.reason}`,
    created_at: now,
    timestamp: now,
  });
}
