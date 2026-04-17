const { getQueryExecutor } = require("../database/client");
const { PRODUCT_TABLE, mapProductRecord } = require("../models/product.model");

class ProductRepository {
  async create(payload, options = {}) {
    const executor = getQueryExecutor(options.executor);
    const [insertedId] = await executor(PRODUCT_TABLE).insert({
      code: payload.code,
      name: payload.name,
      stock: payload.stock,
      price: payload.price,
      version: payload.version ?? 0,
      created_at: executor.fn.now(),
      updated_at: executor.fn.now()
    });

    return this.findById(typeof insertedId === "object" ? insertedId.id : insertedId, options);
  }

  async upsertByCode(payload, options = {}) {
    const executor = getQueryExecutor(options.executor);
    const [upsertedId] = await executor(PRODUCT_TABLE)
      .insert({
        code: payload.code,
        name: payload.name,
        stock: payload.stock,
        price: payload.price,
        version: 0,
        created_at: executor.fn.now(),
        updated_at: executor.fn.now()
      })
      .onConflict("code")
      .merge({
        name: payload.name,
        stock: payload.stock,
        price: payload.price,
        version: 0,
        updated_at: executor.fn.now()
      });

    if (upsertedId) {
      return this.findById(typeof upsertedId === "object" ? upsertedId.id : upsertedId, options);
    }

    return this.findByCode(payload.code, options);
  }

  async findById(id, options = {}) {
    const executor = getQueryExecutor(options.executor);
    const row = await executor(PRODUCT_TABLE).where({ id }).first();
    return mapProductRecord(row);
  }

  async findByCode(code, options = {}) {
    const executor = getQueryExecutor(options.executor);
    const row = await executor(PRODUCT_TABLE).where({ code }).first();
    return mapProductRecord(row);
  }

  async list(options = {}) {
    const executor = getQueryExecutor(options.executor);
    const rows = await executor(PRODUCT_TABLE).select("*").orderBy("id", "asc");
    return rows.map(mapProductRecord);
  }

  async updateStock(payload, options = {}) {
    const executor = getQueryExecutor(options.executor);
    const query = executor(PRODUCT_TABLE).where({ id: payload.productId });

    if (payload.expectedVersion !== undefined) {
      query.andWhere({ version: payload.expectedVersion });
    }

    const updatedRows = await query.update({
      stock: payload.stock,
      version: executor.raw("version + 1"),
      updated_at: executor.fn.now()
    });

    if (!updatedRows) {
      return null;
    }

    return this.findById(payload.productId, options);
  }

  async resetStock(payload, options = {}) {
    const executor = getQueryExecutor(options.executor);
    const updatedRows = await executor(PRODUCT_TABLE)
      .where({ id: payload.productId })
      .update({
        stock: payload.stock,
        price: payload.price,
        name: payload.name,
        version: 0,
        updated_at: executor.fn.now()
      });

    if (!updatedRows) {
      return null;
    }

    return this.findById(payload.productId, options);
  }
}

module.exports = ProductRepository;
