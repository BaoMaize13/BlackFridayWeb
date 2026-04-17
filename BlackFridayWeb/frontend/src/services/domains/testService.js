import {
  coerceArray,
  coercePagination,
  normalizeTestCase,
  normalizeTestReport
} from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";

export async function listTestCases(filters = {}) {
  const payload = await apiClient.requestFirst(
    endpoints.tests.cases.map((path) => ({
      path,
      query: {
        page: filters.page,
        limit: filters.pageSize,
        size: filters.pageSize,
        test_id: filters.testId,
        test_name: filters.search,
        type: filters.type,
        status: filters.status
      }
    }))
  );

  const items = coerceArray(payload).map(normalizeTestCase);
  return {
    items,
    pagination: coercePagination(payload, items.length)
  };
}

export async function runTestCase(testId) {
  return apiClient.request(endpoints.tests.run(testId), {
    method: "POST"
  });
}

export async function listTestReports(filters = {}) {
  const payload = await apiClient.requestFirst(
    endpoints.tests.reports.map((path) => ({
      path,
      query: {
        page: filters.page,
        limit: filters.pageSize,
        size: filters.pageSize,
        report_id: filters.reportId,
        test_case_id: filters.testCaseId,
        product: filters.product,
        result: filters.result
      }
    }))
  );

  const items = coerceArray(payload).map(normalizeTestReport);
  return {
    items,
    pagination: coercePagination(payload, items.length)
  };
}

export async function getTestReport(reportId) {
  const payload = await apiClient.request(endpoints.tests.report(reportId));
  return normalizeTestReport(payload);
}
