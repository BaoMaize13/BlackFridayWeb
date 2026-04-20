import { AppError } from "../../utils/errors";
import { clearStoredSession, getStoredSession } from "../../utils/storage";

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");
}

function toAbsoluteUrl(path, query) {
  const source = path.startsWith("http")
    ? path
    : `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const url = new URL(source);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, value);
    });
  }

  return url.toString();
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
  const session = getStoredSession();
  const headers = new Headers(options.headers ?? {});

  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth !== false && session?.token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }

  try {
    const response = await fetch(toAbsoluteUrl(path, options.query), {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal ?? controller.signal
    });
    const payload = await parseResponse(response);

    if (!response.ok) {
      const errorCode = payload?.error?.code ?? null;
      const error = new AppError(
        payload?.message || payload?.error?.message || `HTTP ${response.status}`,
        {
          status: response.status,
          errorCode,
          details: payload?.error?.details ?? payload
        }
      );

      if (options.auth !== false && response.status === 401) {
        clearStoredSession();
        window.dispatchEvent(new CustomEvent("auth:unauthorized", { detail: { errorCode } }));

        if (window.location.pathname !== "/login") {
          window.location.assign("/login");
        }
      }

      throw error;
    }

    return payload;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new AppError("The request timed out before the backend responded.");
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(error.message || "Unable to reach the backend.", {
      details: error
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export const apiClient = {
  request,
  getApiBaseUrl,
  toAbsoluteUrl
};
