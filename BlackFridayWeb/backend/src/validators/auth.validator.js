const { AUTH_ROLES } = require("../constants/auth.constants");
const { ERROR_CODES, HTTP_STATUS } = require("../constants/system");
const AppError = require("../utils/app-error");

function throwValidationError(details) {
  throw new AppError({
    message: "Validation failed",
    statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    errorCode: ERROR_CODES.VALIDATION_ERROR,
    details
  });
}

function validateRequiredString(value, field, errors) {
  if (typeof value !== "string") {
    errors.push({
      field,
      message: `${field} must be a string`
    });
    return undefined;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    errors.push({
      field,
      message: `${field} must not be empty`
    });
    return undefined;
  }

  return normalizedValue;
}

function validateOptionalString(value, field, errors) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return validateRequiredString(value, field, errors);
}

function validateEmail(value, field, errors) {
  const normalizedValue = validateRequiredString(value, field, errors);

  if (!normalizedValue) {
    return undefined;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedValue)) {
    errors.push({
      field,
      message: `${field} must be a valid email address`
    });
    return undefined;
  }

  return normalizedValue.toLowerCase();
}

function validateOptionalRole(value, errors) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const normalizedRole = String(value).trim().toLowerCase();

  if (!Object.values(AUTH_ROLES).includes(normalizedRole)) {
    errors.push({
      field: "role",
      message: `role must be one of: ${Object.values(AUTH_ROLES).join(", ")}`
    });
    return undefined;
  }

  return normalizedRole;
}

function validateLoginBody(body = {}) {
  const errors = [];
  const email = validateEmail(body.email, "email", errors);
  const password = validateRequiredString(body.password, "password", errors);

  if (errors.length > 0) {
    throwValidationError(errors);
  }

  return {
    email,
    password
  };
}

function validateRegisterBody(body = {}) {
  const errors = [];
  const email = validateEmail(body.email, "email", errors);
  const password = validateRequiredString(body.password, "password", errors);
  const name = validateRequiredString(body.name, "name", errors);
  const username = validateOptionalString(body.username, "username", errors);
  const role = validateOptionalRole(body.role, errors);

  if (errors.length > 0) {
    throwValidationError(errors);
  }

  return {
    email,
    name,
    password,
    role,
    username
  };
}

module.exports = {
  validateLoginBody,
  validateRegisterBody
};
