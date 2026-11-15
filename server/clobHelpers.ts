import { AmmDatabase } from './db';
import { postJournalEntry } from './accounting';

export function ammCancelOrderInternal(
  db: AmmDatabase,
  orderId: string,
  reason: string,
  actorId: string = 'RISK_ENGINE'
): boolean {
  const order = db.prepare(`SELECT * FROM clob_orders WHERE id = ?`).get(orderId) as any;
  if (!order || !order.is_amm || !['OPEN', 'PARTIAL'].includes(order.status)) {
    return false;
  }

  const now = new Date().toISOString();
  const remainingReserved = order.reserved_cents || 0;

  db.prepare(`
    UPDATE clob_orders
    SET status = 'CANCELLED', reserved_cents = 0, updated_at = ?
    WHERE id = ?
  `).run(now, orderId);

  if (remainingReserved > 0) {
    db.prepare(`
      UPDATE amm_market_allocations
      SET reserved_capital_cents = MAX(0, reserved_capital_cents - ?),
          updated_at = ?
      WHERE market_id = ?
    `).run(remainingReserved, now, order.market_id);

    postJournalEntry(db, {
      idempotencyKey: `CANCEL_AMM_ORD_${orderId}`,
      referenceType: 'AMM_ORDER_CANCEL',
      referenceId: orderId,
      marketId: order.market_id,
      description: `Cancelamento de ordem AMM (${reason}): devolução de ${(remainingReserved / 100).toFixed(2)} Kz de reserva para caixa livre.`,
      actorId,
      lines: [
        { accountCode: 'amm_cash', debitCents: remainingReserved },
        { accountCode: 'amm_reserved_cash', creditCents: remainingReserved },
      ],
    });
  }

  return true;
}

export function ammCancelMarketQuotesInternal(
  db: AmmDatabase,
  marketId: string,
  reason: string,
  onlyRiskIncreasing: boolean = false
): number {
  const openOrders = db
    .prepare(`SELECT * FROM clob_orders WHERE market_id = ? AND is_amm = 1 AND status IN ('OPEN', 'PARTIAL')`)
    .all(marketId) as any[];

  const inv = db.prepare(`SELECT * FROM amm_inventory WHERE market_id = ?`).get(marketId) as any;
  const sharesSim = inv?.shares_sim ?? 0;
  const sharesNo = inv?.shares_no ?? 0;

  let cancelledCount = 0;
  for (const ord of openOrders) {
    if (onlyRiskIncreasing) {
      // Keep orders that reduce net imbalance
      const isReducing =
        (ord.side === 'Sell' && ((ord.outcome === 'Yes' && sharesSim >= ord.remaining_quantity) || (ord.outcome === 'No' && sharesNo >= ord.remaining_quantity))) ||
        (ord.side === 'Buy' && ((ord.outcome === 'Yes' && sharesNo > sharesSim) || (ord.outcome === 'No' && sharesSim > sharesNo)));
      if (isReducing) continue;
    }
    if (ammCancelOrderInternal(db, ord.id, reason)) {
      cancelledCount++;
    }
  }

  const now = new Date().toISOString();
  if (!onlyRiskIncreasing) {
    db.prepare(`UPDATE amm_quotes SET status = 'CANCELLED', updated_at = ? WHERE market_id = ? AND status = 'ACTIVE'`)
      .run(now, marketId);
  }

  return cancelledCount;
}
