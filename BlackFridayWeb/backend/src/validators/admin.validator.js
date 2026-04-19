const { ORDER_STATUSES, PURCHASE_LOG_ACTIONS, PURCHASE_LOG_RESULTS } = require("../constants/domain");
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

function isProvided(value) {
  return value !== undefined && value !== null;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : value;
}

function parsePositiveInteger(value, field, errors) {
  const normalizedValue = normalizeString(value);

  if (!isProvided(normalizedValue) || normalizedValue === "") {
    errors.push({
      field,
      message: `${field} must be a positive integer`
    });
    return null;
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    errors.push({
      field,
      message: `${field} must be a positive integer`
    });
    return null;
  }

  return parsedValue;
}

function parseNonNegativeInteger(value, field, errors) {
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

function parseNonNegativeNumber(value, field, errors) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    errors.push({
      field,
      message: `${field} must be a number greater than or equal to 0`
    });
    return null;
  }

  return parsedValue;
}

function parseOptionalBoolean(value, field, errors) {
  if (!isProvided(value)) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalizedValue = normalizeString(value);

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

  return undefined;
}

function parseOptionalNonEmptyString(value, field, errors) {
  if (!isProvided(value)) {
    return undefined;
  }

  if (typeof value !== "string") {
    errors.push({
      field,
      message: `${field} must be a string`
    });
    return undefined;
  }

  const normalizedValue = normalizeString(value);

  if (!normalizedValue) {
    errors.push({
      field,
      message: `${field} must not be empty`
    });
    return undefined;
  }

  return normalizedValue;
}

function parseRequiredNonEmptyString(value, field, errors) {
  if (typeof value !== "string") {
    errors.push({
      field,
      message: `${field} must be a string`
    });
    return undefined;
  }

  const normalizedValue = normalizeString(value);

  if (!normalizedValue) {
    errors.push({
      field,
      message: `${field} must not be empty`
    });
    return undefined;
  }

  return normalizedValue;
}

function parseOptionalEnum(value, field, allowedValues, errors) {
  if (!isProvided(value)) {
    return undefined;
  }

  const normalizedValue = String(value).trim().toUpperCase();

  if (!allowedValues.includes(normalizedValue)) {
    errors.push({
      field,
      message: `${field} must be one of: ${allowedValues.join(", ")}`
    });
    return undefined;
  }

  return normalizedValue;
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

function validateOrderIdParam(value) {
  const errors = [];
  const orderId = parsePositiveInteger(value, "orderId", errors);
  assertValid(errors);
  return orderId;
}

function validateRequestIdParam(value) {
  const errors = [];
  const requestId = parseOptionalNonEmptyString(value, "requestId", errors);
  assertValid(errors);
  return requestId;
}

function validateCreateProductBody(body = {}) {
  const errors = [];
  const code = parseRequiredNonEmptyString(body.code, "code", errors);
  const name = parseRequiredNonEmptyString(body.name, "name", errors);
  const stock = parseNonNegativeInteger(body.stock, "stock", errors);
  const price = parseNonNegativeNumber(body.price, "price", errors);

  assertValid(errors);

  return {
    code,
    name,
    price,
    stock
  };
}

function validateListProductsQuery(query = {}) {
  const errors = [];
  const code = parseOptionalNonEmptyString(query.code, "code", errors);

  assertValid(errors);

  return {
    code
  };
}

function validateUpdateProductStockBody(body = {}) {
  const errors = [];
  const stock = parseNonNegativeInteger(body.stock, "stock", errors);

  assertValid(errors);

  return {
    stock
  };
}

function validateResetProductBody(body = {}) {
  const errors = [];
  const stock = parseNonNegativeInteger(body.stock, "stock", errors);
  const clearOrders = parseOptionalBoolean(body.clearOrders, "clearOrders", errors);
  const clearLogs = parseOptionalBoolean(body.clearLogs, "clearLogs", errors);

  assertValid(errors);

  return {
    stock,
    clearLogs: clearLogs ?? false,
    clearOrders: clearOrders ?? false
  };
}

function validateListOrdersQuery(query = {}) {
  const errors = [];
  const productId = isProvided(query.productId) ? parsePositiveInteger(query.productId, "productId", errors) : undefined;
  const requestId = parseOptionalNonEmptyString(query.requestId, "requestId", errors);
  const status = parseOptionalEnum(query.status, "status", Object.values(ORDER_STATUSES), errors);

  assertValid(errors);

  return {
    productId,
    requestId,
    status
  };
}

function validateDeleteOrdersQuery(query = {}) {
  const errors = [];
  const productId = isProvided(query.productId) ? parsePositiveInteger(query.productId, "productId", errors) : undefined;
  const confirm = parseOptionalBoolean(query.confirm, "confirm", errors);

  assertValid(errors);

  return {
    confirm: confirm ?? false,
    productId
  };
}

function validateListAttemptLogsQuery(query = {}) {
  const errors = [];
  const productId = isProvided(query.productId) ? parsePositiveInteger(query.productId, "productId", errors) : undefined;
  const requestId = parseOptionalNonEmptyString(query.requestId, "requestId", errors);
  const action = parseOptionalEnum(query.action, "action", Object.values(PURCHASE_LOG_ACTIONS), errors);
  const result = parseOptionalEnum(query.result, "result", Object.values(PURCHASE_LOG_RESULTS), errors);

  assertValid(errors);

  return {
    action,
    productId,
    requestId,
    result
  };
}

function validateDeleteAttemptLogsQuery(query = {}) {
  const errors = [];
  const productId = isProvided(query.productId) ? parsePositiveInteger(query.productId, "productId", errors) : undefined;
  const confirm = parseOptionalBoolean(query.confirm, "confirm", errors);

  assertValid(errors);

  return {
    confirm: confirm ?? false,
    productId
  };
}

function validateStatsQuery(query = {}) {
  const errors = [];
  const productId = isProvided(query.productId) ? parsePositiveInteger(query.productId, "productId", errors) : undefined;

  assertValid(errors);

  return {
    productId
  };
}

function validateMetricsQuery(query = {}) {
  const errors = [];
  const productId = isProvided(query.productId) ? parsePositiveInteger(query.productId, "productId", errors) : undefined;
  const initialStock = isProvided(query.initialStock)
    ? parseNonNegativeInteger(query.initialStock, "initialStock", errors)
    : undefined;
  const quantity = isProvided(query.quantity) ? parsePositiveInteger(query.quantity, "quantity", errors) : undefined;
  const includeLogs = parseOptionalBoolean(query.includeLogs, "includeLogs", errors);
  const includeServerBreakdown = parseOptionalBoolean(
    query.includeServerBreakdown,
    "includeServerBreakdown",
    errors
  );

  assertValid(errors);

  return {
    includeLogs: includeLogs ?? false,
    includeServerBreakdown: includeServerBreakdown ?? false,
    initialStock,
    productId,
    quantity
  };
}

module.exports = {
  validateCreateProductBody,
  validateDeleteAttemptLogsQuery,
  validateDeleteOrdersQuery,
  validateListAttemptLogsQuery,
  validateListOrdersQuery,
  validateListProductsQuery,
  validateMetricsQuery,
  validateOrderIdParam,
  validateProductIdParam,
  validateRequestIdParam,
  validateResetProductBody,
  validateStatsQuery,
  validateUpdateProductStockBody
};
