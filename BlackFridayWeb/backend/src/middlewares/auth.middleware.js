const { ERROR_CODES, HTTP_STATUS } = require("../constants/system");
const AppError = require("../utils/app-error");
const authService = require("../services/auth.service");

function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader || typeof authorizationHeader !== "string") {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (!/^Bearer$/i.test(scheme) || !token) {
    return null;
  }

  return token.trim();
}

async function authenticateToken(req, res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      throw new AppError({
        message: "Authorization token is required",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
        errorCode: ERROR_CODES.UNAUTHORIZED
      });
    }

    req.auth = await authService.getAuthenticatedUser(token);
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  authenticateToken
};
