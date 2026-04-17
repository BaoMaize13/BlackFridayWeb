import { AppError } from "../../utils/errors";
import { coerceObject } from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";

function extractSessionPayload(payload) {
  const data = coerceObject(payload);
  const token =
    data.token ??
    data.accessToken ??
    data.access_token ??
    data.jwt ??
    null;
  const user = data.user ?? data.profile ?? data.account ?? null;
  const sessionLabel =
    data.sessionLabel ??
    data.role ??
    (user?.name ? `${user.name}` : null) ??
    (token ? `Session ${token.slice(0, 8)}…` : null);

  return {
    token,
    user,
    sessionLabel
  };
}

async function login(credentials) {
  const payload = await apiClient.request(endpoints.auth.login, {
    method: "POST",
    body: {
      username: credentials.username,
      password: credentials.password
    },
    auth: false
  });

  const session = extractSessionPayload(payload);

  if (!session.token && !session.user) {
    throw new AppError(
      "Authentication succeeded but no token or user payload was returned."
    );
  }

  return session;
}

async function validate(token) {
  const payload = await apiClient.request(endpoints.auth.validate, {
    method: "GET",
    headers: token
      ? {
          Authorization: `Bearer ${token}`
        }
      : undefined,
    auth: false
  });

  return extractSessionPayload(payload);
}

export const authService = {
  login,
  validate
};
