const ORDER_TABLE = "orders";

function mapOrderRecord(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    productId: row.product_id,
    buyerRef: row.buyer_ref,
    quantity: row.quantity,
    status: row.status,
    requestId: row.request_id,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = {
  ORDER_TABLE,
  mapOrderRecord
};
