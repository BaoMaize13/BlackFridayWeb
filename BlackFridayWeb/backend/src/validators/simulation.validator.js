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

function parseInteger(value, field, errors, options = {}) {
  const { defaultValue, min = 1, required = false } = options;

  if (value === undefined || value === null || value === "") {
    if (required) {
      errors.push({
        field,
        message: `${field} is required`
      });
      return null;
    }

    return defaultValue;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < min) {
    errors.push({
      field,
      message: `${field} must be an integer greater than or equal to ${min}`
    });
    return defaultValue ?? null;
  }

  return parsedValue;
}

function assertValid(errors) {
  if (errors.length > 0) {
    throwValidationError(errors);
  }
}

function validateSimulationBody(body = {}) {
  const errors = [];
  const totalRequests = parseInteger(body.totalRequests ?? body.requests, "totalRequests", errors, {
    defaultValue: 20,
    min: 1
  });
  const concurrency = parseInteger(body.concurrency ?? body.threads ?? body.maxConcurrentRequests, "concurrency", errors, {
    defaultValue: totalRequests || 20,
    min: 1
  });
  const payload = {
    artificialDelayMs: parseInteger(body.artificialDelayMs, "artificialDelayMs", errors, {
      defaultValue: undefined,
      min: 0
    }),
    concurrency,
    initialStock: parseInteger(body.initialStock ?? body.stock, "initialStock", errors, {
      defaultValue: 1,
      min: 0
    }),
    productId: parseInteger(body.productId, "productId", errors, {
      defaultValue: undefined,
      min: 1
    }),
    quantity: parseInteger(body.quantity, "quantity", errors, {
      defaultValue: 1,
      min: 1
    }),
    requestPrefix:
      typeof body.requestPrefix === "string" && body.requestPrefix.trim()
        ? body.requestPrefix.trim()
        : undefined,
    totalRequests
  };

  if (payload.concurrency > payload.totalRequests) {
    payload.concurrency = payload.totalRequests;
  }

  assertValid(errors);

  return payload;
}

module.exports = {
  validateSimulationBody
};
