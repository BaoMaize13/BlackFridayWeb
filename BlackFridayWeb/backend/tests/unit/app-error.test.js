const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ERROR_CODES, HTTP_STATUS } = require("../../src/constants/system");
const AppError = require("../../src/utils/app-error");

test("AppError stores message, statusCode, errorCode, and details", () => {
  const error = new AppError({
    details: {
      productId: 1
    },
    errorCode: ERROR_CODES.PRODUCT_NOT_FOUND,
    message: "Product not found",
    statusCode: HTTP_STATUS.NOT_FOUND
  });

  assert.equal(error.name, "AppError");
  assert.equal(error.message, "Product not found");
  assert.equal(error.statusCode, HTTP_STATUS.NOT_FOUND);
  assert.equal(error.errorCode, ERROR_CODES.PRODUCT_NOT_FOUND);
  assert.deepEqual(error.details, {
    productId: 1
  });
  assert.equal(error.exposeMessage, true);
  assert.equal(error.isOperational, true);
});

test("AppError defaults to internal error behavior for unexpected failures", () => {
  const error = new AppError({
    message: "Unexpected crash"
  });

  assert.equal(error.statusCode, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  assert.equal(error.errorCode, ERROR_CODES.INTERNAL_ERROR);
  assert.equal(error.exposeMessage, false);
  assert.equal(error.isOperational, false);
});
