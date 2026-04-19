const adminMetricsService = require("../services/admin-metrics.service");
const { sendSuccess } = require("../utils/response");
const { validateMetricsQuery } = require("../validators/admin.validator");

async function getAdminMetrics(req, res) {
  const filter = validateMetricsQuery(req.query);
  const metrics = await adminMetricsService.getMetrics(filter);

  return sendSuccess(res, req, {
    data: metrics,
    message: "Admin metrics retrieved successfully"
  });
}

module.exports = {
  getAdminMetrics
};
