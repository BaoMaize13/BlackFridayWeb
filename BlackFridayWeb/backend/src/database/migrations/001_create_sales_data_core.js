const { ORDER_STATUSES, PURCHASE_LOG_ACTIONS, PURCHASE_LOG_RESULTS } = require("../../constants/domain");

function buildTextCheck(values) {
  return `TEXT NOT NULL CHECK (${values.column} IN (${values.allowed.map((value) => `'${value}'`).join(", ")}))`;
}

function addTimestampColumns(table, knex) {
  table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
  table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
}

exports.up = async function up(knex) {
  const orderStatuses = Object.values(ORDER_STATUSES);
  const purchaseLogActions = Object.values(PURCHASE_LOG_ACTIONS);
  const purchaseLogResults = Object.values(PURCHASE_LOG_RESULTS);

  await knex.schema.createTable("products", (table) => {
    table.increments("id").primary();
    table.string("code", 64).notNullable().unique();
    table.string("name", 255).notNullable();
    table.specificType("stock", "INTEGER NOT NULL CHECK (stock >= 0)");
    table.specificType("price", "NUMERIC(12, 2) NOT NULL CHECK (price >= 0)");
    table.specificType("version", "INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0)");
    addTimestampColumns(table, knex);
    table.index(["created_at"], "idx_products_created_at");
  });

  await knex.schema.createTable("orders", (table) => {
    table.increments("id").primary();
    table
      .integer("product_id")
      .notNullable()
      .references("id")
      .inTable("products")
      .onDelete("RESTRICT");
    table.string("buyer_ref", 100).notNullable();
    table.specificType("quantity", "INTEGER NOT NULL CHECK (quantity > 0)");
    table.specificType(
      "status",
      buildTextCheck({
        column: "status",
        allowed: orderStatuses
      })
    );
    table.string("request_id", 128).notNullable().unique();
    table.text("failure_reason").nullable();
    addTimestampColumns(table, knex);
    table.index(["product_id"], "idx_orders_product_id");
    table.index(["status"], "idx_orders_status");
    table.index(["created_at"], "idx_orders_created_at");
    table.index(["product_id", "status"], "idx_orders_product_status");
  });

  await knex.schema.createTable("purchase_logs", (table) => {
    table.increments("id").primary();
    table.string("request_id", 128).notNullable();
    table.string("server_id", 128).notNullable();
    table
      .integer("product_id")
      .notNullable()
      .references("id")
      .inTable("products")
      .onDelete("RESTRICT");
    table.specificType("stock_before", "INTEGER CHECK (stock_before IS NULL OR stock_before >= 0)");
    table.specificType("stock_after", "INTEGER CHECK (stock_after IS NULL OR stock_after >= 0)");
    table.specificType(
      "action",
      buildTextCheck({
        column: "action",
        allowed: purchaseLogActions
      })
    );
    table.specificType(
      "result",
      buildTextCheck({
        column: "result",
        allowed: purchaseLogResults
      })
    );
    table.text("message").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["request_id"], "idx_purchase_logs_request_id");
    table.index(["product_id"], "idx_purchase_logs_product_id");
    table.index(["created_at"], "idx_purchase_logs_created_at");
    table.index(["product_id", "created_at"], "idx_purchase_logs_product_created_at");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("purchase_logs");
  await knex.schema.dropTableIfExists("orders");
  await knex.schema.dropTableIfExists("products");
};
