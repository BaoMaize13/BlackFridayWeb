const request = require("supertest");

const { createApp } = require("../../src/app");

const app = createApp();

function getRequestClient() {
  return request(app);
}

function createPurchasePayload({ productId, quantity = 1, requestId, userId }) {
  return {
    productId,
    quantity,
    requestId,
    userId
  };
}

async function sendConcurrentPurchases({
  endpoint,
  productId,
  quantity,
  requests,
  requestPrefix,
  userPrefix
}) {
  const client = getRequestClient();

  return Promise.all(
    Array.from({ length: requests }, (_, index) => {
      const requestId = `${requestPrefix}-${String(index + 1).padStart(3, "0")}`;
      const userId = `${userPrefix}-${String(index + 1).padStart(3, "0")}`;

      return client
        .post(endpoint)
        .set("x-request-id", requestId)
        .send(
          createPurchasePayload({
            productId,
            quantity,
            requestId,
            userId
          })
        );
    })
  );
}

module.exports = {
  createPurchasePayload,
  getRequestClient,
  sendConcurrentPurchases
};
