import { coerceArray, coerceObject, normalizeTestReport } from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";

const staticTestCases = [
  {
    id: "TC01",
    name: "No-lock race condition",
    type: "NO_LOCK",
    status: "READY",
    description: "Stock = 1, 20 concurrent requests, expect oversell evidence."
  },
  {
    id: "TC02",
    name: "With-lock inventory protection",
    type: "LOCK",
    status: "READY",
    description: "Stock = 1, 20 concurrent requests, expect one success and no negative stock."
  },
  {
    id: "TC05",
    name: "Multi-server with-lock",
    type: "CONSISTENCY",
    status: "MANUAL",
    description: "Run two backend instances and alternate requests across both base URLs."
  }
];

export async function listTestCases() {
  return {
    items: staticTestCases,
    pagination: {
      page: 1,
      pageSize: staticTestCases.length,
      total: staticTestCases.length
    }
  };
}

export async function runTestCase(testId) {
  if (testId === "TC01") {
    return apiClient.request(endpoints.simulation.noLock, {
      auth: false,
      method: "POST",
      body: {
        initialStock: 1,
        totalRequests: 20,
        concurrency: 20,
        quantity: 1
      },
      timeoutMs: 60000
    });
  }

  if (testId === "TC02") {
    return apiClient.request(endpoints.simulation.withLock, {
      auth: false,
      method: "POST",
      body: {
        initialStock: 1,
        totalRequests: 20,
        concurrency: 20,
        quantity: 1
      },
      timeoutMs: 60000
    });
  }

  throw new Error("This test case is documented for manual CLI execution.");
}

export async function listTestReports(filters = {}) {
  const payload = await apiClient.request(endpoints.simulation.reports, {
    auth: false
  });
  const items = coerceArray(payload)
    .map((entry) => {
      const item = coerceObject(entry);

      return normalizeTestReport({
        id: item.id ?? item.fileName,
        productId: item.productId,
        result: item.requirementPassed === false ? "FAILED" : item.oversellDetected ? "WARNING" : "PASSED",
        successRate:
          item.successCount !== null && item.failedCount !== null
            ? item.successCount / Math.max(1, item.successCount + item.failedCount)
            : null,
        createdAt: item.timestamp,
        summary: item
      });
    })
    .filter((item) => {
      if (filters.result && item.result !== filters.result) return false;
      if (filters.product && String(item.productId) !== String(filters.product)) return false;
      if (filters.reportId && !String(item.id).includes(String(filters.reportId))) return false;
      return true;
    });

  return {
    items,
    pagination: {
      page: 1,
      pageSize: items.length,
      total: items.length
    }
  };
}

export async function getTestReport(reportId) {
  const payload = await apiClient.request(endpoints.simulation.reportDetail(reportId), {
    auth: false
  });

  return normalizeTestReport({
    id: payload?.data?.id ?? payload?.id ?? reportId,
    productId: payload?.data?.productId ?? payload?.productId,
    result: payload?.data?.requirementPassed === false ? "FAILED" : "PASSED",
    createdAt: payload?.data?.timestamp ?? payload?.timestamp,
    summary: payload?.data ?? payload
  });
}
