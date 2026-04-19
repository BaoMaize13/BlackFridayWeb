const adminAttemptLogService = require("../services/admin-attempt-log.service");
const { sendSuccess } = require("../utils/response");
const {
  validateDeleteAttemptLogsQuery,
  validateListAttemptLogsQuery,
  validateRequestIdParam
} = require("../validators/admin.validator");

async function listAttemptLogs(req, res) {
  const filter = validateListAttemptLogsQuery(req.query);
  const attemptLogs = await adminAttemptLogService.listAttemptLogs(filter);

  return sendSuccess(res, req, {
    message: "Attempt logs retrieved successfully",
    data: attemptLogs,
    meta: {
      totalItems: attemptLogs.length
    }
  });
}

async function getAttemptLogsByRequestId(req, res) {
  const requestId = validateRequestIdParam(req.params.requestId);
  const attemptLogs = await adminAttemptLogService.getAttemptLogsByRequestId(requestId);

  return sendSuccess(res, req, {
    message: "Attempt logs for request retrieved successfully",
    data: attemptLogs,
    meta: {
      totalItems: attemptLogs.length
    }
  });
}

async function deleteAttemptLogs(req, res) {
  const filter = validateDeleteAttemptLogsQuery(req.query);
  const result = await adminAttemptLogService.deleteAttemptLogs(filter, {
    logger: req.context?.logger
  });

  return sendSuccess(res, req, {
    message: "Attempt logs deleted successfully",
    data: result
  });
}

module.exports = {
  deleteAttemptLogs,
  getAttemptLogsByRequestId,
  listAttemptLogs
};
