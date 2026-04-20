const { AUTH_ROLES, AUTH_USER_STATUSES } = require("../../constants/auth.constants");

function buildTextCheck(column, allowedValues) {
  return `TEXT NOT NULL CHECK (${column} IN (${allowedValues.map((value) => `'${value}'`).join(", ")}))`;
}

exports.up = async function up(knex) {
  await knex.schema.createTable("users", (table) => {
    table.increments("id").primary();
    table.string("email", 255).notNullable().unique();
    table.string("username", 64).notNullable().unique();
    table.string("name", 255).notNullable();
    table.string("password_hash", 255).notNullable();
    table.specificType("role", buildTextCheck("role", Object.values(AUTH_ROLES)));
    table.specificType("status", buildTextCheck("status", Object.values(AUTH_USER_STATUSES)));
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    table.index(["role"], "idx_users_role");
    table.index(["status"], "idx_users_status");
    table.index(["created_at"], "idx_users_created_at");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("users");
};
