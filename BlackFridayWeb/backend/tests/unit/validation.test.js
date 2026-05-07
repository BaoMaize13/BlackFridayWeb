const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ERROR_CODES, HTTP_STATUS } = require("../../src/constants/system");
const { validatePurchaseNoLockBody, validatePurchaseWithLockBody } = require("../../src/validators/purchase.validator");

function assertValidationError(executeValidation, expectedField) {
  assert.throws(executeValidation, (error) => {
    assert.equal(error.errorCode, ERROR_CODES.VALIDATION_ERROR);
    assert.equal(error.statusCode, HTTP_STATUS.BAD_REQUEST);
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
    artificialDelayMs: undefined,
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

test("validatePurchaseNoLockBody defaults missing userId for demo requests", () => {
  const payload = validatePurchaseNoLockBody({
    productId: 1,
    quantity: 1,
    requestId: "req-003"
  });

  assert.equal(payload.userId, "demo-user");
});

test("validatePurchaseNoLockBody allows missing requestId", () => {
  const payload = validatePurchaseNoLockBody({
    productId: 1,
    quantity: 1,
    userId: "user-003"
  });

  assert.equal(payload.requestId, undefined);
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

test("validatePurchaseWithLockBody rejects invalid optional requestId", () => {
  assertValidationError(
    () =>
      validatePurchaseWithLockBody({
        productId: 1,
        quantity: 1,
        requestId: 123,
        userId: "user-006"
      }),
    "requestId"
  );
});
