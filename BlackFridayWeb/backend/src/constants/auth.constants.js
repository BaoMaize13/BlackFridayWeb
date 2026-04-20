const AUTH_ROLES = Object.freeze({
  ADMIN: "admin",
  OWNER: "owner",
  USER: "user",
  PENDING_OWNER: "pending_owner"
});

const AUTH_USER_STATUSES = Object.freeze({
  ACTIVE: "active",
  DISABLED: "disabled",
  PENDING: "pending"
});

module.exports = {
  AUTH_ROLES,
  AUTH_USER_STATUSES
};
