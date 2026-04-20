import { throwUnsupportedFeature } from "../api/unsupported";

export async function listTestCases(filters = {}) {
  return throwUnsupportedFeature("Test case APIs");
}

export async function runTestCase(testId) {
  return throwUnsupportedFeature("Test execution APIs");
}

export async function listTestReports(filters = {}) {
  return throwUnsupportedFeature("Test report APIs");
}

export async function getTestReport(reportId) {
  return throwUnsupportedFeature("Test report detail APIs");
}
