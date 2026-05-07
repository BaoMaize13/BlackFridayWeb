const activityService = require("../services/activity.service");
const { sendSuccess } = require("../utils/response");

function parseOptionalPositiveInteger(value) {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : undefined;
}

function buildActivityFilter(query = {}) {
  return {
    productId: parseOptionalPositiveInteger(query.productId),
    requestId: typeof query.requestId === "string" && query.requestId.trim() ? query.requestId.trim() : undefined
  };
}

async function getPurchaseHistory(req, res) {
  const history = await activityService.getPurchaseHistory(buildActivityFilter(req.query));

  return sendSuccess(res, req, {
    message: "Purchase history retrieved successfully",
    data: history
  });
}

async function listActivities(req, res) {
  const activities = await activityService.listActivities(buildActivityFilter(req.query));

  return sendSuccess(res, req, {
    message: "Activities retrieved successfully",
    data: activities,
    meta: {
      totalItems: activities.length
    }
  });
}

module.exports = {
  getPurchaseHistory,
  listActivities
};
