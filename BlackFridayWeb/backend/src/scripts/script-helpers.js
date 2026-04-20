function parseArguments(argv = process.argv.slice(2)) {
  const parsedArgs = {};

  for (const argument of argv) {
    if (!argument.startsWith("--")) {
      continue;
    }

    const normalizedArgument = argument.slice(2);
    const separatorIndex = normalizedArgument.indexOf("=");

    if (separatorIndex === -1) {
      parsedArgs[normalizedArgument] = "true";
      continue;
    }

    const key = normalizedArgument.slice(0, separatorIndex);
    const value = normalizedArgument.slice(separatorIndex + 1);
    parsedArgs[key] = value;
  }

  return parsedArgs;
}

function parsePositiveInteger(value, fieldName, options = {}) {
  const { allowUndefined = false, min = 1 } = options;

  if (value === undefined || value === null || value === "") {
    if (allowUndefined) {
      return undefined;
    }

    throw new Error(`${fieldName} is required and must be an integer greater than or equal to ${min}`);
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < min) {
    throw new Error(`${fieldName} must be an integer greater than or equal to ${min}`);
  }

  return parsedValue;
}

function parseBoolean(value, fieldName, defaultValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalizedValue = String(value).trim().toLowerCase();

  if (normalizedValue === "true") {
    return true;
  }

  if (normalizedValue === "false") {
    return false;
  }

  throw new Error(`${fieldName} must be either true or false`);
}

function parseOptionalString(value, fieldName, defaultValue) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new Error(`${fieldName} must not be empty`);
  }

  return normalizedValue;
}

function buildUrl(baseUrl, pathname, query = {}) {
  const url = new URL(pathname, baseUrl);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
}

function buildAuthorizationHeaders(token, headers = {}) {
  if (!token) {
    return headers;
  }

  return {
    ...headers,
    Authorization: `Bearer ${token}`
  };
}

async function requestJson(baseUrl, method, pathname, options = {}) {
  const { body, headers = {}, query, timeoutMs = 10000 } = options;
  const url = buildUrl(baseUrl, pathname, query);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers
      },
      method,
      signal: abortController.signal
    });

    const rawBody = await response.text();
    let parsedBody = null;

    if (rawBody.trim()) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch (error) {
        parsedBody = null;
      }
    }

    return {
      body: parsedBody,
      ok: response.ok,
      rawBody,
      statusCode: response.status,
      url: url.toString()
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Request to ${url.toString()} timed out after ${timeoutMs}ms`);
    }

    throw new Error(`Request to ${url.toString()} failed: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function authenticateAdmin(baseUrl, options = {}) {
  const email = parseOptionalString(
    options.adminEmail || process.env.ADMIN_EMAIL || process.env.AUTH_EMAIL,
    "adminEmail",
    "admin@example.com"
  );
  const password = parseOptionalString(
    options.adminPassword || process.env.ADMIN_PASSWORD || process.env.AUTH_PASSWORD,
    "adminPassword",
    "password"
  );
  const response = await requestJson(baseUrl, "POST", "/api/auth/login", {
    auth: false,
    body: {
      email,
      password
    },
    timeoutMs: options.timeoutMs || 10000
  });
  const session = unwrapApiSuccess(`POST ${new URL("/api/auth/login", baseUrl).toString()}`, response);

  if (!session?.token) {
    throw new Error("Admin authentication succeeded but no JWT token was returned.");
  }

  return session;
}

function describeApiFailure(label, response) {
  const errorCode = response.body?.error?.code ? ` [${response.body.error.code}]` : "";
  const message = response.body?.message || response.rawBody || "Unexpected API response";
  return `${label} failed with status ${response.statusCode}${errorCode}: ${message}`;
}

function unwrapApiSuccess(label, response) {
  if (!response.ok) {
    throw new Error(describeApiFailure(label, response));
  }

  if (!response.body || typeof response.body !== "object" || response.body.success !== true) {
    throw new Error(`${label} returned an invalid JSON envelope`);
  }

  return response.body.data;
}

function extractSettledApiData(settledResult, label) {
  if (settledResult.status === "rejected") {
    return {
      available: false,
      errorMessage: settledResult.reason.message
    };
  }

  try {
    return {
      available: true,
      data: unwrapApiSuccess(label, settledResult.value)
    };
  } catch (error) {
    return {
      available: false,
      errorMessage: error.message
    };
  }
}

function printSection(title) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

function formatBooleanForOutput(value) {
  if (value === null || value === undefined) {
    return "UNKNOWN";
  }

  return value ? "YES" : "NO";
}

function toRoundedMs(value) {
  return Number(value.toFixed(2));
}

function padNumber(value) {
  return String(value).padStart(3, "0");
}

function aggregateCounts(values = []) {
  return values.reduce((accumulator, value) => {
    accumulator[value] = (accumulator[value] || 0) + 1;
    return accumulator;
  }, {});
}

module.exports = {
  aggregateCounts,
  authenticateAdmin,
  buildAuthorizationHeaders,
  buildUrl,
  describeApiFailure,
  extractSettledApiData,
  formatBooleanForOutput,
  padNumber,
  parseArguments,
  parseBoolean,
  parseOptionalString,
  parsePositiveInteger,
  printSection,
  requestJson,
  toRoundedMs,
  unwrapApiSuccess
};
