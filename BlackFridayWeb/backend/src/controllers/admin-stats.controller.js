const adminStatsService = require("../services/admin-stats.service");
const { sendSuccess } = require("../utils/response");
const { validateStatsQuery } = require("../validators/admin.validator");

async function getAdminStats(req, res) {
  const filter = validateStatsQuery(req.query);
  const stats = await adminStatsService.getStats(filter);

  return sendSuccess(res, req, {
    message: "Admin stats retrieved successfully",
    data: stats
  });
}

module.exports = {
  getAdminStats
};
