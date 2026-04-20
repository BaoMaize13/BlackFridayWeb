const jwt = require("jsonwebtoken");

const { AUTH_ROLES, AUTH_USER_STATUSES } = require("../constants/auth.constants");
const { authConfig } = require("../config");
const { ERROR_CODES, HTTP_STATUS } = require("../constants/system");
const { UserRepository } = require("../repositories");
const AppError = require("../utils/app-error");
const { comparePassword, hashPassword } = require("../utils/password.util");

const userRepository = new UserRepository();

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function buildJwtPayload(user) {
  return {
    email: user.email,
    role: user.role,
    sub: String(user.id),
    username: user.username
  };
}

function buildSessionResponse(user) {
  const sanitizedUser = sanitizeUser(user);

  return {
    token: jwt.sign(buildJwtPayload(sanitizedUser), authConfig.jwtSecret, {
      expiresIn: authConfig.expiresIn
    }),
    user: sanitizedUser
  };
}

function createInvalidCredentialsError() {
  return new AppError({
    message: "Invalid email or password",
    statusCode: HTTP_STATUS.UNAUTHORIZED,
    errorCode: ERROR_CODES.INVALID_CREDENTIALS
  });
}

function createInvalidTokenError() {
  return new AppError({
    message: "Token is invalid or expired",
    statusCode: HTTP_STATUS.UNAUTHORIZED,
    errorCode: ERROR_CODES.INVALID_TOKEN
  });
}

function createForbiddenUserError() {
  return new AppError({
    message: "User account is not active",
    statusCode: HTTP_STATUS.FORBIDDEN,
    errorCode: ERROR_CODES.FORBIDDEN
  });
}

function createUserNotFoundError() {
  return new AppError({
    message: "User account could not be found",
    statusCode: HTTP_STATUS.UNAUTHORIZED,
    errorCode: ERROR_CODES.USER_NOT_FOUND
  });
}

function deriveUsername(email, fallbackUsername) {
  if (fallbackUsername) {
    return fallbackUsername.trim().toLowerCase();
  }

  return String(email).split("@")[0].trim().toLowerCase();
}

function isUniqueConstraintError(error, fieldName) {
  const message = String(error?.message || "");

  if (error?.code === "SQLITE_CONSTRAINT") {
    return message.includes(`users.${fieldName}`);
  }

  if (error?.code === "23505") {
    return message.includes(`users_${fieldName}`) || message.includes(fieldName);
  }

  return false;
}

class AuthService {
  async register(payload) {
    const passwordHash = await hashPassword(payload.password);

    try {
      const user = await userRepository.createUser({
        email: payload.email,
        name: payload.name,
        passwordHash,
        role: AUTH_ROLES.USER,
        status: AUTH_USER_STATUSES.ACTIVE,
        username: deriveUsername(payload.email, payload.username)
      });

      return buildSessionResponse(user);
    } catch (error) {
      if (isUniqueConstraintError(error, "email")) {
        throw new AppError({
          message: `Email '${payload.email}' already exists`,
          statusCode: HTTP_STATUS.CONFLICT,
          errorCode: ERROR_CODES.EMAIL_ALREADY_EXISTS
        });
      }

      if (isUniqueConstraintError(error, "username")) {
        throw new AppError({
          message: `Username '${deriveUsername(payload.email, payload.username)}' already exists`,
          statusCode: HTTP_STATUS.CONFLICT,
          errorCode: ERROR_CODES.USERNAME_ALREADY_EXISTS
        });
      }

      throw error;
    }
  }

  async login(payload) {
    const user = await userRepository.findUserByEmail(payload.email);

    if (!user) {
      throw createInvalidCredentialsError();
    }

    const passwordMatched = await comparePassword(payload.password, user.passwordHash);

    if (!passwordMatched) {
      throw createInvalidCredentialsError();
    }

    if (user.status !== AUTH_USER_STATUSES.ACTIVE) {
      throw createForbiddenUserError();
    }

    return buildSessionResponse(user);
  }

  async getAuthenticatedUser(token) {
    let decodedToken;

    try {
      decodedToken = jwt.verify(token, authConfig.jwtSecret);
    } catch (error) {
      throw createInvalidTokenError();
    }

    const user = await userRepository.findUserById(Number(decodedToken.sub));

    if (!user) {
      throw createUserNotFoundError();
    }

    if (user.status !== AUTH_USER_STATUSES.ACTIVE) {
      throw createForbiddenUserError();
    }

    return {
      tokenPayload: decodedToken,
      user: sanitizeUser(user)
    };
  }

  async seedUsers(seedUsers, options = {}) {
    const seededUsers = [];

    for (const seedUser of seedUsers) {
      const passwordHash = await hashPassword(seedUser.password);
      const user = await userRepository.upsertUserByEmail(
        {
          email: seedUser.email,
          name: seedUser.name,
          passwordHash,
          role: seedUser.role,
          status: seedUser.status,
          username: seedUser.username
        },
        options
      );

      seededUsers.push(sanitizeUser(user));
    }

    return seededUsers;
  }
}

module.exports = new AuthService();
