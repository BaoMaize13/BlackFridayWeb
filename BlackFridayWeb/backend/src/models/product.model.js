const PRODUCT_TABLE = "products";

function mapProductRecord(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    stock: row.stock,
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = {
  PRODUCT_TABLE,
  mapProductRecord
};
