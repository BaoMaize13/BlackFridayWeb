const { lockConfig } = require("../config");
const { LOCK_RESOURCE_TYPES } = require("../constants/lock.constants");

function buildProductLockKey(productId) {
  if (productId === undefined || productId === null || String(productId).trim() === "") {
    throw new Error("productId is required to build product lock key");
  }

  return `${lockConfig.keyPrefix}:${LOCK_RESOURCE_TYPES.PRODUCT}:${productId}`;
}

module.exports = {
  buildProductLockKey
};
