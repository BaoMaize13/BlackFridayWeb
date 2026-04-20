const { USER_TABLE, mapUserRecord } = require("../models/user.model");
const { extractInsertedId, isProvided, resolveExecutor } = require("./repository.utils");

function applyUserFilters(query, filter = {}) {
  if (isProvided(filter.userId)) {
    query.where({ id: filter.userId });
  }

  if (isProvided(filter.email)) {
    query.whereRaw("LOWER(email) = LOWER(?)", [filter.email]);
  }

  if (isProvided(filter.username)) {
    query.whereRaw("LOWER(username) = LOWER(?)", [filter.username]);
  }

  if (isProvided(filter.role)) {
    query.where({ role: filter.role });
  }

  if (isProvided(filter.status)) {
    query.where({ status: filter.status });
  }
}

class UserRepository {
  async createUser(data, options = {}) {
    const executor = resolveExecutor(options);
    const insertResult = await executor(USER_TABLE).insert({
      email: data.email,
      username: data.username,
      name: data.name,
      password_hash: data.passwordHash,
      role: data.role,
      status: data.status,
      created_at: executor.fn.now(),
      updated_at: executor.fn.now()
    });
    const userId = extractInsertedId(insertResult);

    if (userId) {
      return this.findUserById(userId, options);
    }

    return this.findUserByEmail(data.email, options);
  }

  async upsertUserByEmail(data, options = {}) {
    const executor = resolveExecutor(options);

    await executor(USER_TABLE)
      .insert({
        email: data.email,
        username: data.username,
        name: data.name,
        password_hash: data.passwordHash,
        role: data.role,
        status: data.status,
        created_at: executor.fn.now(),
        updated_at: executor.fn.now()
      })
      .onConflict("email")
      .merge({
        username: data.username,
        name: data.name,
        password_hash: data.passwordHash,
        role: data.role,
        status: data.status,
        updated_at: executor.fn.now()
      });

    return this.findUserByEmail(data.email, options);
  }

  async findUserById(userId, options = {}) {
    const executor = resolveExecutor(options);
    const row = await executor(USER_TABLE).where({ id: userId }).first();
    return mapUserRecord(row);
  }

  async findUserByEmail(email, options = {}) {
    const executor = resolveExecutor(options);
    const row = await executor(USER_TABLE)
      .whereRaw("LOWER(email) = LOWER(?)", [email])
      .first();

    return mapUserRecord(row);
  }

  async findUserByUsername(username, options = {}) {
    const executor = resolveExecutor(options);
    const row = await executor(USER_TABLE)
      .whereRaw("LOWER(username) = LOWER(?)", [username])
      .first();

    return mapUserRecord(row);
  }

  async findUserByEmailOrUsername(identifier, options = {}) {
    const executor = resolveExecutor(options);
    const row = await executor(USER_TABLE)
      .whereRaw("LOWER(email) = LOWER(?)", [identifier])
      .orWhereRaw("LOWER(username) = LOWER(?)", [identifier])
      .first();

    return mapUserRecord(row);
  }

  async listUsers(filter = {}, options = {}) {
    const executor = resolveExecutor(options);
    const query = executor(USER_TABLE).select("*");

    applyUserFilters(query, filter);

    const rows = await query.orderBy("id", "asc");
    return rows.map(mapUserRecord);
  }
}

module.exports = UserRepository;
