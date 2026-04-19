const purchaseService = require("../services/purchase.service");
const { sendSuccess } = require("../utils/response");
const { validatePurchaseNoLockBody, validatePurchaseWithLockBody } = require("../validators/purchase.validator");

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

async function purchaseWithLock(req, res) {
  const payload = validatePurchaseWithLockBody(req.body);
  const result = await purchaseService.purchaseWithLock(payload, {
    logger: req.context?.logger,
    requestId: req.context?.requestId,
    serverId: req.context?.serverId
  });

  return sendSuccess(res, req, {
    message: result.isDuplicate
      ? "Purchase request already processed. Returned existing order."
      : "Purchase completed successfully with distributed lock.",
    data: result
  });
}

module.exports = {
  purchaseWithoutLock,
  purchaseWithLock
};
