const PURCHASE_LOG_TABLE = "purchase_logs";

function mapPurchaseLogRecord(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    requestId: row.request_id,
    serverId: row.server_id,
    productId: row.product_id,
    stockBefore: row.stock_before,
    stockAfter: row.stock_after,
    action: row.action,
    result: row.result,
    message: row.message,
    createdAt: row.created_at
  };
}

module.exports = {
  PURCHASE_LOG_TABLE,
  mapPurchaseLogRecord
};
