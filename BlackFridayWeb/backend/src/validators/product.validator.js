const { ERROR_CODES, HTTP_STATUS } = require("../constants/system");
const AppError = require("../utils/app-error");

function throwValidationError(details) {
  throw new AppError({
    message: "Validation failed",
    statusCode: HTTP_STATUS.BAD_REQUEST,
    errorCode: ERROR_CODES.VALIDATION_ERROR,
    details
  });
}

function parsePositiveInteger(value, field, errors) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    errors.push({
      field,
      message: `${field} must be a positive integer`
    });
    return null;
  }

  return parsedValue;
}

function parseNonNegativeInteger(value, field, errors, defaultValue = undefined) {
  if ((value === undefined || value === null || value === "") && defaultValue !== undefined) {
    return defaultValue;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    errors.push({
      field,
      message: `${field} must be an integer greater than or equal to 0`
    });
    return null;
  }

  return parsedValue;
}

function parseOptionalBoolean(value, field, errors, defaultValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalizedValue = String(value).trim().toLowerCase();

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  errors.push({
    field,
    message: `${field} must be a boolean`
  });
  return defaultValue;
}

function assertValid(errors) {
  if (errors.length > 0) {
    throwValidationError(errors);
  }
}

function validateProductIdParam(value) {
  const errors = [];
  const productId = parsePositiveInteger(value, "productId", errors);
  assertValid(errors);
  return productId;
}

function validateResetStockBody(body = {}) {
  const errors = [];
  const stock = parseNonNegativeInteger(body.stock ?? body.initialStock, "stock", errors, 1);
  const clearOrders = parseOptionalBoolean(body.clearOrders, "clearOrders", errors, true);
  const clearLogs = parseOptionalBoolean(body.clearLogs, "clearLogs", errors, true);

  assertValid(errors);

  return {
    clearLogs,
    clearOrders,
    stock
  };
}

module.exports = {
  validateProductIdParam,
  validateResetStockBody
};
