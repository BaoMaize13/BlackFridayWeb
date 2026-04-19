const { lockConfig } = require("../config");
const { LOCK_RESOURCE_TYPES } = require("../constants/lock.constants");

function buildProductLockKey(productId) {
  return `${lockConfig.keyPrefix}:${LOCK_RESOURCE_TYPES.PRODUCT}:${productId}`;
}

module.exports = {
  buildProductLockKey
};
