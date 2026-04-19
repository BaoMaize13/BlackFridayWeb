const { PURCHASE_LOG_ACTIONS, PURCHASE_LOG_RESULTS } = require("../../constants/domain");

const LEGACY_PURCHASE_LOG_ACTIONS = Object.freeze([
  "REQUEST_RECEIVED",
  "STOCK_READ",
  "STOCK_UPDATED",
  "ORDER_CREATED"
]);

function buildTextCheck(column, values) {
  return `TEXT NOT NULL CHECK (${column} IN (${values.map((value) => `'${value}'`).join(", ")}))`;
}

async function dropPurchaseLogIndexes(knex) {
  const indexNames = [
    "idx_purchase_logs_request_id",
    "idx_purchase_logs_product_id",
    "idx_purchase_logs_created_at",
    "idx_purchase_logs_product_created_at"
  ];

  for (const indexName of indexNames) {
    await knex.raw(`DROP INDEX IF EXISTS ${indexName}`);
  }
}

async function createPurchaseLogsTable(knex, actions) {
  await knex.schema.createTable("purchase_logs", (table) => {
    table.increments("id").primary();
    table.string("request_id", 128).notNullable();
    table.string("server_id", 128).notNullable();
    table.integer("product_id").nullable().references("id").inTable("products").onDelete("RESTRICT");
    table.specificType("stock_before", "INTEGER CHECK (stock_before IS NULL OR stock_before >= 0)");
    table.specificType("stock_after", "INTEGER CHECK (stock_after IS NULL OR stock_after >= 0)");
    table.specificType("action", buildTextCheck("action", actions));
    table.specificType("result", buildTextCheck("result", Object.values(PURCHASE_LOG_RESULTS)));
    table.text("message").nullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["request_id"], "idx_purchase_logs_request_id");
    table.index(["product_id"], "idx_purchase_logs_product_id");
    table.index(["created_at"], "idx_purchase_logs_created_at");
    table.index(["product_id", "created_at"], "idx_purchase_logs_product_created_at");
  });
}

exports.up = async function up(knex) {
  const hasPurchaseLogsTable = await knex.schema.hasTable("purchase_logs");

  if (!hasPurchaseLogsTable) {
    await createPurchaseLogsTable(knex, Object.values(PURCHASE_LOG_ACTIONS));
    return;
  }

  await dropPurchaseLogIndexes(knex);
  await knex.schema.renameTable("purchase_logs", "purchase_logs_legacy");
  await createPurchaseLogsTable(knex, Object.values(PURCHASE_LOG_ACTIONS));

  await knex("purchase_logs").insert(
    knex("purchase_logs_legacy").select(
      "id",
      "request_id",
      "server_id",
      "product_id",
      "stock_before",
      "stock_after",
      "action",
      "result",
      "message",
      "created_at"
    )
  );

  await knex.schema.dropTable("purchase_logs_legacy");
};

exports.down = async function down(knex) {
  const hasPurchaseLogsTable = await knex.schema.hasTable("purchase_logs");

  if (!hasPurchaseLogsTable) {
    return;
  }

  await dropPurchaseLogIndexes(knex);
  await knex.schema.renameTable("purchase_logs", "purchase_logs_modern");
  await createPurchaseLogsTable(knex, LEGACY_PURCHASE_LOG_ACTIONS);

  await knex("purchase_logs").insert(
    knex("purchase_logs_modern")
      .select(
        "id",
        "request_id",
        "server_id",
        "product_id",
        "stock_before",
        "stock_after",
        "action",
        "result",
        "message",
        "created_at"
      )
      .whereNotNull("product_id")
      .whereIn("action", LEGACY_PURCHASE_LOG_ACTIONS)
  );

  await knex.schema.dropTable("purchase_logs_modern");
};
