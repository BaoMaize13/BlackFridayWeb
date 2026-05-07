const { ERROR_CODES, HTTP_STATUS } = require("../constants/system");
const simulationService = require("../services/simulation.service");
const AppError = require("../utils/app-error");
const { sendSuccess } = require("../utils/response");
const { validateSimulationBody } = require("../validators/simulation.validator");

async function runNoLockSimulation(req, res) {
  const payload = validateSimulationBody(req.body);
  const result = await simulationService.runSimulation("NO_LOCK", payload, {
    logger: req.context?.logger,
    serverId: req.context?.serverId
  });

  return sendSuccess(res, req, {
    message: "No-lock simulation completed",
    data: result
  });
}

async function runWithLockSimulation(req, res) {
  const payload = validateSimulationBody(req.body);
  const result = await simulationService.runSimulation("WITH_LOCK", payload, {
    logger: req.context?.logger,
    serverId: req.context?.serverId
  });

  return sendSuccess(res, req, {
    message: "With-lock simulation completed",
    data: result
  });
}

async function runCompareSimulation(req, res) {
  const payload = validateSimulationBody(req.body);
  const result = await simulationService.compare(payload, {
    logger: req.context?.logger,
    serverId: req.context?.serverId
  });

  return sendSuccess(res, req, {
    message: "Simulation comparison completed",
    data: result
  });
}

async function listReports(req, res) {
  const reports = simulationService.listReports();

  return sendSuccess(res, req, {
    message: "Simulation reports retrieved successfully",
    data: reports,
    meta: {
      totalItems: reports.length
    }
  });
}

async function getReport(req, res) {
  const report = simulationService.getReport(req.params.id);

  if (!report) {
    throw new AppError({
      message: `Simulation report '${req.params.id}' was not found`,
      statusCode: HTTP_STATUS.NOT_FOUND,
      errorCode: ERROR_CODES.NOT_FOUND || "REPORT_NOT_FOUND"
    });
  }

  return sendSuccess(res, req, {
    message: "Simulation report retrieved successfully",
    data: report
  });
}

module.exports = {
  getReport,
  listReports,
  runCompareSimulation,
  runNoLockSimulation,
  runWithLockSimulation
};
