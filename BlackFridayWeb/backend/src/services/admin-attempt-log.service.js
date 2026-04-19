const { ERROR_CODES, HTTP_STATUS } = require("../constants/system");
const { PurchaseAttemptRepository } = require("../repositories");
const AppError = require("../utils/app-error");

const purchaseAttemptRepository = new PurchaseAttemptRepository();

class AdminAttemptLogService {
  async listAttemptLogs(filter = {}) {
    return purchaseAttemptRepository.listAttemptLogs(filter);
  }

  async getAttemptLogsByRequestId(requestId) {
    return purchaseAttemptRepository.listAttemptLogsByRequestId(requestId);
  }

  async deleteAttemptLogs(filter = {}, options = {}) {
    let deletedCount = 0;
    let scope = "all";

    if (filter.productId) {
      deletedCount = await purchaseAttemptRepository.deleteAttemptLogsByProduct(filter.productId);
      scope = "product";
    } else {
      if (!filter.confirm) {
        throw new AppError({
          message: "confirm=true is required to delete all attempt logs",
          statusCode: HTTP_STATUS.BAD_REQUEST,
          errorCode: ERROR_CODES.CONFIRMATION_REQUIRED
        });
      }

      deletedCount = await purchaseAttemptRepository.deleteAllAttemptLogsForTest();
    }

    options.logger?.info(
      {
        action: "admin.delete_attempt_logs",
        deletedCount,
        productId: filter.productId ?? null,
        scope
      },
      "Admin attempt logs deleted"
    );

    return {
      deletedCount,
      productId: filter.productId ?? null,
      scope
    };
  }
}

module.exports = new AdminAttemptLogService();
