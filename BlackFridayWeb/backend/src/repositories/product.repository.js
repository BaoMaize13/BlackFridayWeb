const { PRODUCT_TABLE, mapProductRecord } = require("../models/product.model");
const { applyCreatedAtFilter, extractInsertedId, isProvided, resolveExecutor } = require("./repository.utils");

function applyProductFilters(query, filter = {}) {
  if (Array.isArray(filter.productIds) && filter.productIds.length > 0) {
    query.whereIn("id", filter.productIds);
  }

  if (isProvided(filter.productId)) {
    query.where({ id: filter.productId });
  }

  if (isProvided(filter.code)) {
    query.where({ code: filter.code });
  }

  if (Array.isArray(filter.codes) && filter.codes.length > 0) {
    query.whereIn("code", filter.codes);
  }

  applyCreatedAtFilter(query, filter);
}

class ProductRepository {
  async createProduct(data, options = {}) {
    const executor = resolveExecutor(options);
    const insertResult = await executor(PRODUCT_TABLE)
      .insert({
        code: data.code,
        name: data.name,
        stock: data.stock,
        price: data.price,
        version: data.version ?? 0,
        created_at: executor.fn.now(),
        updated_at: executor.fn.now()
      });

    const productId = extractInsertedId(insertResult);

    if (productId) {
      return this.findProductById(productId, options);
    }

    return this.findProductByCode(data.code, options);
  }

  async upsertProductByCode(data, options = {}) {
    const executor = resolveExecutor(options);

    await executor(PRODUCT_TABLE)
      .insert({
        code: data.code,
        name: data.name,
        stock: data.stock,
        price: data.price,
        version: 0,
        created_at: executor.fn.now(),
        updated_at: executor.fn.now()
      })
      .onConflict("code")
      .merge({
        name: data.name,
        stock: data.stock,
        price: data.price,
        version: 0,
        updated_at: executor.fn.now()
      });

    return this.findProductByCode(data.code, options);
  }

  async findProductById(productId, options = {}) {
    const executor = resolveExecutor(options);
    const row = await executor(PRODUCT_TABLE).where({ id: productId }).first();
    return mapProductRecord(row);
  }

  async findProductByCode(productCode, options = {}) {
    const executor = resolveExecutor(options);
    const row = await executor(PRODUCT_TABLE).where({ code: productCode }).first();
    return mapProductRecord(row);
  }

  async listProducts(filter = {}, options = {}) {
    const executor = resolveExecutor(options);
    const query = executor(PRODUCT_TABLE).select("*");

    applyProductFilters(query, filter);

    const rows = await query.orderBy("id", "asc");
    return rows.map(mapProductRecord);
  }

  async countProducts(filter = {}, options = {}) {
    const executor = resolveExecutor(options);
    const query = executor(PRODUCT_TABLE);

    applyProductFilters(query, filter);

    const row = await query.count({ total: "*" }).first();
    return Number(row?.total ?? 0);
  }

  async updateProductStock(productId, newStock, options = {}) {
    const executor = resolveExecutor(options);
    const query = executor(PRODUCT_TABLE).where({ id: productId });

    if (isProvided(options.expectedVersion)) {
      query.andWhere({ version: options.expectedVersion });
    }

    const updatedRows = await query.update({
      stock: newStock,
      version: executor.raw("version + 1"),
      updated_at: executor.fn.now()
    });

    if (!updatedRows) {
      return null;
    }

    return this.findProductById(productId, options);
  }

  async incrementProductStock(productId, amount, options = {}) {
    const executor = resolveExecutor(options);
    const query = executor(PRODUCT_TABLE).where({ id: productId });

    if (isProvided(options.expectedVersion)) {
      query.andWhere({ version: options.expectedVersion });
    }

    const updatedRows = await query.update({
      stock: executor.raw("stock + ?", [amount]),
      version: executor.raw("version + 1"),
      updated_at: executor.fn.now()
    });

    if (!updatedRows) {
      return null;
    }

    return this.findProductById(productId, options);
  }

  async resetProductStock(productId, stock, options = {}) {
    const executor = resolveExecutor(options);
    const updatedRows = await executor(PRODUCT_TABLE)
      .where({ id: productId })
      .update({
        stock,
        version: options.version ?? 0,
        updated_at: executor.fn.now()
      });

    if (!updatedRows) {
      return null;
    }

    return this.findProductById(productId, options);
  }
}

module.exports = ProductRepository;
