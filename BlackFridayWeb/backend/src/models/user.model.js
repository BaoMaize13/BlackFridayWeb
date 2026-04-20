const USER_TABLE = "users";

function mapUserRecord(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    username: row.username,
    name: row.name,
    role: row.role,
    status: row.status,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = {
  USER_TABLE,
  mapUserRecord
};
