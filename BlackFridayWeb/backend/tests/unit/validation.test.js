const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ERROR_CODES, HTTP_STATUS } = require("../../src/constants/system");
const { validatePurchaseNoLockBody, validatePurchaseWithLockBody } = require("../../src/validators/purchase.validator");

function assertValidationError(executeValidation, expectedField) {
  assert.throws(executeValidation, (error) => {
    assert.equal(error.errorCode, ERROR_CODES.VALIDATION_ERROR);
    assert.equal(error.statusCode, HTTP_STATUS.UNPROCESSABLE_ENTITY);
    assert.equal(Array.isArray(error.details), true);
    assert.equal(
      error.details.some((detail) => detail.field === expectedField),
      true
    );
    return true;
  });
}

test("validatePurchaseNoLockBody returns normalized payload for valid input", () => {
  const payload = validatePurchaseNoLockBody({
    productId: "12",
    quantity: "2",
    requestId: "req-001",
    userId: "user-001"
  });

  assert.deepEqual(payload, {
    productId: 12,
    quantity: 2,
    requestId: "req-001",
    userId: "user-001"
  });
});

test("validatePurchaseNoLockBody rejects missing productId", () => {
  assertValidationError(
    () =>
      validatePurchaseNoLockBody({
        quantity: 1,
        requestId: "req-002",
        userId: "user-002"
      }),
    "productId"
  );
});

test("validatePurchaseNoLockBody rejects missing userId", () => {
  assertValidationError(
    () =>
      validatePurchaseNoLockBody({
        productId: 1,
        quantity: 1,
        requestId: "req-003"
      }),
    "userId"
  );
});

test("validatePurchaseNoLockBody rejects missing requestId", () => {
  assertValidationError(
    () =>
      validatePurchaseNoLockBody({
        productId: 1,
        quantity: 1,
        userId: "user-003"
      }),
    "requestId"
  );
});

test("validatePurchaseNoLockBody rejects quantity less than or equal to zero", () => {
  assertValidationError(
    () =>
      validatePurchaseNoLockBody({
        productId: 1,
        quantity: 0,
        requestId: "req-004",
        userId: "user-004"
      }),
    "quantity"
  );
});

test("validatePurchaseNoLockBody rejects non-integer quantity", () => {
  assertValidationError(
    () =>
      validatePurchaseNoLockBody({
        productId: 1,
        quantity: 1.5,
        requestId: "req-005",
        userId: "user-005"
      }),
    "quantity"
  );
});

test("validatePurchaseWithLockBody uses the same validation rules as no-lock", () => {
  assertValidationError(
    () =>
      validatePurchaseWithLockBody({
        productId: 1,
        quantity: 1,
        requestId: "",
        userId: "user-006"
      }),
    "requestId"
  );
});
