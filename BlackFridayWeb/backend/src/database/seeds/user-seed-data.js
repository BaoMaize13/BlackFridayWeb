const { AUTH_ROLES, AUTH_USER_STATUSES } = require("../../constants/auth.constants");

const seedUsers = [
  {
    email: "admin@example.com",
    username: "admin",
    name: "Admin",
    password: "password",
    role: AUTH_ROLES.ADMIN,
    status: AUTH_USER_STATUSES.ACTIVE
  },
  {
    email: "user@example.com",
    username: "user",
    name: "Demo User",
    password: "password",
    role: AUTH_ROLES.USER,
    status: AUTH_USER_STATUSES.ACTIVE
  }
];

module.exports = seedUsers;
