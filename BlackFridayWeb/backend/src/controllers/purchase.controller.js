const purchaseService = require("../services/purchase.service");
const { sendSuccess } = require("../utils/response");
const { validatePurchaseNoLockBody } = require("../validators/purchase.validator");

async function purchaseWithoutLock(req, res) {
  const payload = validatePurchaseNoLockBody(req.body);
  const result = await purchaseService.purchaseWithoutLock(payload, {
    logger: req.context?.logger,
    serverId: req.context?.serverId
  });

  return sendSuccess(res, req, {
    message: "Purchase processed without lock",
    data: result
  });
}

module.exports = {
  purchaseWithoutLock
};
