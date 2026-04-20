const { HTTP_STATUS } = require("../constants/system");
const authService = require("../services/auth.service");
const { sendSuccess } = require("../utils/response");
const { validateLoginBody, validateRegisterBody } = require("../validators/auth.validator");

async function login(req, res) {
  const payload = validateLoginBody(req.body);
  const session = await authService.login(payload);

  return sendSuccess(res, req, {
    message: "Login successful",
    data: session
  });
}

async function register(req, res) {
  const payload = validateRegisterBody(req.body);
  const session = await authService.register(payload);

  return sendSuccess(res, req, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Registration successful",
    data: session
  });
}

async function getCurrentUser(req, res) {
  return sendSuccess(res, req, {
    message: "Session is valid",
    data: {
      user: req.auth.user
    }
  });
}

async function logout(req, res) {
  return sendSuccess(res, req, {
    message: "Logout successful",
    data: {
      loggedOut: true
    }
  });
}

module.exports = {
  getCurrentUser,
  login,
  logout,
  register
};
