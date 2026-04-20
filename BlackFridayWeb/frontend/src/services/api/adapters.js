function unwrapEnvelope(payload) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    if (payload.data !== undefined) return payload.data;
    if (payload.payload !== undefined) return payload.payload;
  }
  return payload;
}

export function coerceObject(payload) {
  const value = unwrapEnvelope(payload);
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return {};
}

export function coerceArray(payload) {
  const value = unwrapEnvelope(payload);
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.records)) return value.records;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.list)) return value.list;
  return [];
}

export function coercePagination(payload, fallbackCount = 0) {
  const value = coerceObject(payload);
  const total = Number(
    value.total ??
      value.totalItems ??
      value.count ??
      value.total_count ??
      fallbackCount
  );

  return {
    page: Number(value.page ?? value.currentPage ?? 1),
    pageSize: Number((value.pageSize ?? value.limit ?? value.size ?? fallbackCount) || 10),
    total
  };
}

export function normalizeHealth(payload) {
  const data = coerceObject(payload);
  const database = coerceObject(data.services?.database);
  const redis = coerceObject(data.services?.redis);

  function normalizeService(service) {
    return {
      ...service,
      status:
        service.connected === true
          ? "ACTIVE"
          : service.configured === true
            ? "DEGRADED"
            : "OFFLINE"
    };
  }

  return {
    status: data.status ?? "unknown",
    appName: data.appName ?? null,
    environment: data.environment ?? null,
    timestamp: data.timestamp ?? null,
    serverId: data.server?.id ?? data.serverId ?? null,
    serverPort: data.server?.port ?? data.port ?? null,
    services: {
      database: normalizeService(database),
      redis: normalizeService(redis)
    }
  };
}

export function normalizeProduct(payload) {
  const item = coerceObject(payload);
  const stock = Number(item.stock ?? item.quantity ?? item.inventory ?? 0);
  const price = Number(item.price ?? item.unitPrice ?? 0);

  return {
    id: item.id ?? item.productId ?? item.product_id ?? item.code ?? item.sku ?? null,
    code: item.code ?? item.sku ?? item.productCode ?? null,
    name: item.name ?? item.productName ?? item.title ?? "Unknown product",
    stock: Number.isNaN(stock) ? null : stock,
    price: Number.isNaN(price) ? null : price,
    version: item.version ?? item.revision ?? null,
    createdAt: item.createdAt ?? item.created_at ?? null,
    updatedAt: item.updatedAt ?? item.updated_at ?? null
  };
}

export function normalizeOrder(payload, productsById = new Map()) {
  const item = coerceObject(payload);
  const productId = item.productId ?? item.product_id ?? item.product?.id ?? null;
  const relatedProduct = productsById.get(String(productId)) ?? null;

  return {
    id: item.id ?? item.orderId ?? item.order_id ?? item.requestId ?? null,
    requestId: item.requestId ?? item.request_id ?? null,
    productId,
    productName:
      item.productName ??
      item.product_name ??
      item.product?.name ??
      relatedProduct?.name ??
      "Unknown product",
    buyerRef: item.buyerRef ?? item.buyer_ref ?? item.userId ?? null,
    quantity: Number(item.quantity ?? item.qty ?? 0) || null,
    status: item.status ?? item.result ?? "UNKNOWN",
    failureReason: item.failureReason ?? item.failure_reason ?? null,
    createdAt: item.createdAt ?? item.created_at ?? item.timestamp ?? null,
    updatedAt: item.updatedAt ?? item.updated_at ?? null
  };
}

function deriveLogLevel(item) {
  const explicit = item.level ?? item.logLevel;
  if (explicit) return explicit.toUpperCase();
  const result = String(item.result ?? "").toUpperCase();
  if (result === "FAILED") return "ERROR";
  if (result === "SKIPPED") return "WARN";
  return "INFO";
}

export function normalizeLog(payload, productsById = new Map()) {
  const item = coerceObject(payload);
  const productId = item.productId ?? item.product_id ?? null;
  const relatedProduct = productsById.get(String(productId)) ?? null;

  return {
    id: item.id ?? item.logId ?? item.log_id ?? item.requestId ?? null,
    requestId: item.requestId ?? item.request_id ?? null,
    productId,
    productName:
      item.productName ??
      item.product_name ??
      relatedProduct?.name ??
      "Unknown product",
    serverId: item.serverId ?? item.server_id ?? null,
    action: item.action ?? item.eventType ?? item.type ?? "INFO",
    result: item.result ?? null,
    level: deriveLogLevel(item),
    message: item.message ?? item.description ?? item.detail ?? "No message provided.",
    stockBefore: item.stockBefore ?? item.stock_before ?? null,
    stockAfter: item.stockAfter ?? item.stock_after ?? null,
    createdAt: item.createdAt ?? item.created_at ?? item.timestamp ?? null
  };
}

export function normalizePurchaseResponse(payload) {
  const data = coerceObject(payload);
  const order = coerceObject(data.order);
  const stock = coerceObject(data.stock);
  const product = coerceObject(data.product);
  const updatedProduct = coerceObject(data.updatedProduct);

  return {
    success:
      order.status === "SUCCESS" ||
      data.result === "SUCCESS" ||
      Boolean(data.isDuplicate) ||
      Boolean(product.id || updatedProduct.id || data.delayMs !== undefined),
    message: payload?.message ?? data.message ?? "Purchase request completed.",
    orderId: order.id ?? data.orderId ?? data.order_id ?? null,
    requestId: data.requestId ?? data.request_id ?? order.requestId ?? null,
    quantity: Number(order.quantity ?? data.quantity ?? data.qty ?? 0) || null,
    newStock:
      data.newStock ??
      data.stockAfter ??
      stock.after ??
      product.stock ??
      updatedProduct.stock ??
      data.stock ??
      data.stock_after ??
      null,
    order: order.id ? normalizeOrder(order) : null,
    status: order.status ?? data.result ?? null,
    stockBefore: data.stockBefore ?? stock.before ?? null,
    stockAfter:
      data.stockAfter ??
      stock.after ??
      product.stock ??
      updatedProduct.stock ??
      null,
    isDuplicate: Boolean(data.isDuplicate),
    raw: data
  };
}

export function normalizeSimulationResult(payload) {
  const data = coerceObject(payload);
  const summary = coerceObject(data.summary ?? data.metrics ?? data.result ?? data);
  const results = coerceArray(data.results ?? data.requests ?? data.records);
  const logs = coerceArray(data.logs ?? data.events ?? data.messages);

  return {
    summary: {
      productId: summary.productId ?? summary.product_id ?? null,
      totalRequests: Number(summary.totalRequests ?? summary.total_requests ?? results.length) || 0,
      successCount: Number(summary.successCount ?? summary.success_count ?? summary.success ?? 0) || 0,
      failureCount: Number(summary.failureCount ?? summary.fail_count ?? summary.failed ?? summary.fail ?? 0) || 0,
      consistent: summary.consistent ?? summary.dataConsistent ?? summary.data_consistent ?? null,
      oversellDetected: summary.oversellDetected ?? summary.oversell_detected ?? summary.oversold ?? null,
      initialStock: summary.initialStock ?? summary.initial_stock ?? null,
      finalStock: summary.finalStock ?? summary.final_stock ?? null,
      durationMs: Number(summary.durationMs ?? summary.duration ?? summary.total_duration ?? 0) || null,
      lockType: summary.lockType ?? summary.lock_type ?? null,
      waitingQueue: summary.waitingQueue ?? summary.waiting_queue ?? null,
      contentionCount: summary.lockContentions ?? summary.lock_contentions ?? null
    },
    results: results.map((entry, index) => {
      const item = coerceObject(entry);
      return {
        id: item.id ?? item.threadId ?? item.thread_id ?? `${index + 1}`,
        thread: item.thread ?? item.threadId ?? item.thread_id ?? index + 1,
        status: item.status ?? item.result ?? "UNKNOWN",
        quantity: item.quantity ?? item.qty ?? null,
        stockBefore: item.stockBefore ?? item.stock_before ?? null,
        stockAfter: item.stockAfter ?? item.stock_after ?? null,
        lockWaitMs: item.lockWaitMs ?? item.lock_wait_ms ?? null,
        timestamp: item.timestamp ?? item.createdAt ?? item.created_at ?? null
      };
    }),
    logs: logs.map((entry) => {
      const item = coerceObject(entry);
      return {
        timestamp: item.timestamp ?? item.createdAt ?? item.created_at ?? null,
        level: item.level ?? item.result ?? "INFO",
        message: item.message ?? item.detail ?? item.description ?? "No log message returned."
      };
    }),
    charts: data.chart ?? data.charts ?? null
  };
}

export function normalizeCompareSimulation(payload) {
  const data = coerceObject(payload);
  const leftPayload =
    data.no_lock ??
    data.noLock ??
    data.unlocked ??
    data.without_lock ??
    data.withoutLock ??
    null;
  const rightPayload =
    data.with_lock ??
    data.withLock ??
    data.locked ??
    data.protected ??
    data.protected_lock ??
    null;

  const noLock = leftPayload ? normalizeSimulationResult(leftPayload) : null;
  const withLock = rightPayload ? normalizeSimulationResult(rightPayload) : null;
  const summary = coerceObject(data.summary ?? data.overview ?? data.meta ?? {});
  const metrics = coerceArray(data.metrics).map((entry) => {
    const item = coerceObject(entry);
    return {
      label: item.label ?? item.metric ?? item.name ?? "Metric",
      noLock: item.noLock ?? item.no_lock ?? item.nolock ?? item.left ?? null,
      withLock: item.withLock ?? item.with_lock ?? item.withlock ?? item.right ?? null,
      verdict: item.verdict ?? item.recommendation ?? item.note ?? null
    };
  });

  if (!noLock && !withLock) {
    const single = normalizeSimulationResult(payload);
    return {
      summary: {
        productId: single.summary.productId,
        totalRequests: single.summary.totalRequests,
        initialStock: single.summary.initialStock,
        durationMs: single.summary.durationMs
      },
      noLock: single,
      withLock: null,
      metrics,
      charts: data.chart ?? data.charts ?? null,
      raw: data
    };
  }

  return {
    summary: {
      productId:
        summary.productId ??
        summary.product_id ??
        noLock?.summary.productId ??
        withLock?.summary.productId ??
        null,
      totalRequests:
        Number(
          summary.totalRequests ??
            summary.total_requests ??
            noLock?.summary.totalRequests ??
            withLock?.summary.totalRequests ??
            0
        ) || 0,
      initialStock:
        summary.initialStock ??
        summary.initial_stock ??
        noLock?.summary.initialStock ??
        withLock?.summary.initialStock ??
        null,
      durationMs:
        Number(
          summary.durationMs ??
            summary.duration ??
            summary.total_duration ??
            (noLock?.summary.durationMs ?? 0) + (withLock?.summary.durationMs ?? 0)
        ) || null
    },
    noLock,
    withLock,
    metrics,
    charts: data.chart ?? data.charts ?? null,
    raw: data
  };
}

export function normalizeSettings(payload) {
  const data = coerceObject(payload);
  const source = coerceObject(data.settings ?? data.config ?? data);

  return {
    lockEnabled: source.lock_enabled ?? source.lockEnabled ?? null,
    lockType: source.lock_type ?? source.lockType ?? null,
    lockTimeoutMs: source.lock_timeout_ms ?? source.lockTimeout ?? null,
    retryCount: source.max_retry_count ?? source.retryCount ?? null,
    retryIntervalMs: source.retry_interval_ms ?? source.retryInterval ?? null,
    leaseDurationMs: source.lease_duration_ms ?? source.leaseDuration ?? null,
    queueStrategy: source.queue_strategy ?? source.queueStrategy ?? null,
    autoRefreshEnabled: source.auto_refresh_enabled ?? source.autoRefreshEnabled ?? null,
    refreshIntervalSec: source.refresh_interval_sec ?? source.refreshIntervalSec ?? null,
    raw: source
  };
}

export function normalizeTestCase(payload) {
  const item = coerceObject(payload);
  return {
    id: item.id ?? item.testId ?? item.test_id ?? null,
    name: item.name ?? item.testName ?? "Unnamed test case",
    type: item.type ?? item.category ?? "UNKNOWN",
    status: item.status ?? "UNKNOWN",
    description: item.description ?? item.summary ?? "",
    lastExecutedAt: item.lastExecutedAt ?? item.last_executed_at ?? null,
    raw: item
  };
}

export function normalizeTestReport(payload) {
  const item = coerceObject(payload);
  return {
    id: item.id ?? item.reportId ?? item.report_id ?? null,
    testCaseId: item.testCaseId ?? item.test_case_id ?? null,
    productId: item.productId ?? item.product_id ?? null,
    result: item.result ?? item.status ?? "UNKNOWN",
    successRate: item.successRate ?? item.success_rate ?? null,
    createdAt: item.createdAt ?? item.created_at ?? item.generatedAt ?? null,
    summary: item.summary ?? item.details ?? null,
    raw: item
  };
}
