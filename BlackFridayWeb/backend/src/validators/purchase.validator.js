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

function validatePositiveInteger(value, field, errors) {
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

function validatePurchaseNoLockBody(body = {}) {
  const errors = [];
  const productId = validatePositiveInteger(body.productId, "productId", errors);
  const quantity = validatePositiveInteger(body.quantity, "quantity", errors);
  const requestId = validateRequiredString(body.requestId, "requestId", errors);
  const userId = validateRequiredString(body.userId, "userId", errors);

  if (errors.length > 0) {
    throwValidationError(errors);
  }

  return {
    productId,
    quantity,
    requestId,
    userId
  };
}

module.exports = {
  validatePurchaseNoLockBody
};
