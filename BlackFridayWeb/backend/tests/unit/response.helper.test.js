const assert = require("node:assert/strict");
const { test } = require("node:test");

const { ERROR_CODES, HTTP_STATUS } = require("../../src/constants/system");
const { sendError, sendSuccess } = require("../../src/utils/response");

function createMockResponse() {
  return {
    payload: null,
    statusCode: null,
    json(payload) {
      this.payload = payload;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    }
  };
}

test("sendSuccess returns standardized success response format", () => {
  const req = {
    context: {
      requestId: "response-success-001"
    }
  };
  const res = createMockResponse();

  sendSuccess(res, req, {
    data: {
      id: 1
    },
    message: "Created",
    statusCode: HTTP_STATUS.CREATED
  });

  assert.equal(res.statusCode, HTTP_STATUS.CREATED);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.message, "Created");
  assert.deepEqual(res.payload.data, { id: 1 });
  assert.equal(res.payload.meta.requestId, "response-success-001");
  assert.equal(typeof res.payload.meta.timestamp, "string");
});

test("sendError returns standardized error response format", () => {
  const req = {
    context: {
      requestId: "response-error-001"
    }
  };
  const res = createMockResponse();

  sendError(res, req, {
    details: [{ field: "quantity", message: "quantity must be a positive integer" }],
    errorCode: ERROR_CODES.VALIDATION_ERROR,
    message: "Validation failed",
    statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY
  });

  assert.equal(res.statusCode, HTTP_STATUS.UNPROCESSABLE_ENTITY);
  assert.equal(res.payload.success, false);
  assert.equal(res.payload.message, "Validation failed");
  assert.equal(res.payload.error.code, ERROR_CODES.VALIDATION_ERROR);
  assert.equal(Array.isArray(res.payload.error.details), true);
  assert.equal(res.payload.meta.requestId, "response-error-001");
});
