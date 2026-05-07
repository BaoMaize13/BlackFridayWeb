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

function validateOptionalString(value, field, errors) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return validateRequiredString(value, field, errors);
}

function validateOptionalNonNegativeInteger(value, field, errors) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    errors.push({
      field,
      message: `${field} must be an integer greater than or equal to 0`
    });
    return undefined;
  }

  return parsedValue;
}

function validatePurchaseNoLockBody(body = {}) {
  const errors = [];
  const productId = validatePositiveInteger(body.productId, "productId", errors);
  const quantity = validatePositiveInteger(body.quantity, "quantity", errors);
  const requestId = validateOptionalString(body.requestId, "requestId", errors);
  const userId = validateOptionalString(body.userId, "userId", errors);
  const artificialDelayMs = validateOptionalNonNegativeInteger(
    body.artificialDelayMs,
    "artificialDelayMs",
    errors
  );

  if (errors.length > 0) {
    throwValidationError(errors);
  }

  return {
    artificialDelayMs,
    productId,
    requestId,
    quantity,
    userId: userId || "demo-user"
  };
}

function validatePurchaseWithLockBody(body = {}) {
  return validatePurchaseNoLockBody(body);
}

module.exports = {
  validatePurchaseNoLockBody,
  validatePurchaseWithLockBody
};
