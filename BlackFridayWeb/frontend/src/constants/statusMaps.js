export const STATUS_TONES = {
  SUCCESS: "success",
  PASSED: "success",
  HEALTHY: "success",
  ACTIVE: "success",
  AVAILABLE: "success",
  ONLINE: "success",
  CONSISTENT: "success",
  FAILED: "danger",
  ERROR: "danger",
  OFFLINE: "danger",
  OVERSOLD: "danger",
  CRITICAL: "danger",
  PENDING: "warn",
  RUNNING: "warn",
  WAITING: "warn",
  WARN: "warn",
  DEGRADED: "warn",
  LOW: "warn",
  IDLE: "muted",
  UNKNOWN: "muted",
  DISABLED: "muted",
  INFO: "info"
};

export function getStatusTone(status) {
  const normalized = String(status ?? "UNKNOWN").toUpperCase();
  return STATUS_TONES[normalized] ?? "info";
}
