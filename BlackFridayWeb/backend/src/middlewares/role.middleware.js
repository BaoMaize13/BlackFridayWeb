const { ERROR_CODES, HTTP_STATUS } = require("../constants/system");
const AppError = require("../utils/app-error");

function requireRole(...allowedRoles) {
  const normalizedRoles = allowedRoles.map((role) => String(role).trim().toLowerCase());

  return (req, res, next) => {
    const currentRole = String(req.auth?.user?.role || "").trim().toLowerCase();

    if (!currentRole || !normalizedRoles.includes(currentRole)) {
      return next(
        new AppError({
          message: "You do not have permission to access this resource",
          statusCode: HTTP_STATUS.FORBIDDEN,
          errorCode: ERROR_CODES.FORBIDDEN
        })
      );
    }

    return next();
  };
}

module.exports = {
  requireRole
};
