const bcrypt = require("bcryptjs");

const PASSWORD_SALT_ROUNDS = 10;

async function hashPassword(password) {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

async function comparePassword(password, passwordHash) {
  if (!passwordHash) {
    return false;
  }

  return bcrypt.compare(password, passwordHash);
}

module.exports = {
  comparePassword,
  hashPassword
};
