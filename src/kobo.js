import { randomUUID } from "node:crypto";

/** Default KoBoCAT host for v1 JSON submissions. Use `kc-eu.kobotoolbox.org` for EU projects. */
const DEFAULT_SUBMISSION_BASE_URL = "https://kc.kobotoolbox.org";

/** Default KPI host for v2 reads (assets, submission data). Use `eu.kobotoolbox.org` for EU projects. */
const DEFAULT_API_BASE_URL = "https://kf.kobotoolbox.org";

/** Thrown when the Kobo API returns a non-2xx response. Carries HTTP status and parsed body for debugging. */
export class KoboApiError extends Error {
  constructor(message, { status, responseBody } = {}) {
    super(message);
    this.name = "KoboApiError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

/**
 * Create a scoped Kobo client bound to one asset (form).
 * Prefer this over calling the standalone functions directly when working with one form repeatedly.
 */
export function createKoboClient({
  apiToken,
  assetUid,
  formUuid,
  submissionBaseUrl = DEFAULT_SUBMISSION_BASE_URL,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiToken) {
    throw new TypeError("apiToken is required");
  }

  if (!assetUid) {
    throw new TypeError("assetUid is required");
  }

  assertFetchImpl(fetchImpl);

  const normalizedSubmissionBaseUrl = normalizeBaseUrl(submissionBaseUrl);
  const normalizedApiBaseUrl = normalizeBaseUrl(apiBaseUrl);

  return {
    submitData(data) {
      if (!formUuid) {
        throw new TypeError("formUuid is required");
      }

      return submitKoboData({
        apiToken,
        assetUid,
        formUuid,
        submissionBaseUrl: normalizedSubmissionBaseUrl,
        data,
        fetchImpl,
      });
    },

    listData({ limit = 100, start = 0, query } = {}) {
      return fetchKoboDataPage({
        apiToken,
        assetUid,
        limit,
        start,
        query,
        apiBaseUrl: normalizedApiBaseUrl,
        fetchImpl,
      });
    },

    getAllData({ query } = {}) {
      return fetchAllKoboData({
        apiToken,
        assetUid,
        query,
        apiBaseUrl: normalizedApiBaseUrl,
        fetchImpl,
      });
    },

    getSubmission(submissionId) {
      return fetchKoboSubmission({
        apiToken,
        assetUid,
        submissionId,
        apiBaseUrl: normalizedApiBaseUrl,
        fetchImpl,
      });
    },

    getAsset() {
      return fetchKoboAsset({
        apiToken,
        assetUid,
        apiBaseUrl: normalizedApiBaseUrl,
        fetchImpl,
      });
    },
  };
}

/**
 * POST a submission via the v1 JSON API (`/api/v1/submissions.json`).
 * @param {object} options
 * @param {string} options.apiToken - Kobo API token (sent as `Authorization: Token …`).
 * @param {string} options.assetUid - Form id string (asset UID).
 * @param {string} options.formUuid - Deployment UUID (`deployment__uuid` from the asset metadata).
 * @param {Record<string, unknown>} options.data - Form field values; keys must match form field names.
 * @param {string} [options.submissionBaseUrl] - KoBoCAT base URL (no trailing slash required).
 * @param {typeof fetch} [options.fetchImpl] - Injectable fetch for tests or older runtimes.
 * @returns {Promise<object|string|null>} Parsed JSON body, raw text if not JSON, or null if empty.
 */
export async function submitKoboData({
  apiToken,
  assetUid,
  formUuid,
  data,
  submissionBaseUrl = DEFAULT_SUBMISSION_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiToken) {
    throw new TypeError("apiToken is required");
  }

  if (!assetUid) {
    throw new TypeError("assetUid is required");
  }

  if (!formUuid) {
    throw new TypeError("formUuid is required");
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new TypeError("data must be a plain object");
  }

  assertFetchImpl(fetchImpl);

  const url = `${normalizeBaseUrl(submissionBaseUrl)}/api/v1/submissions.json`;
  const payload = buildSubmissionPayload({ assetUid, formUuid, data });

  return koboRequest(url, {
    apiToken,
    method: "POST",
    body: payload,
    fetchImpl,
  });
}

/**
 * Fetch one page of submission data from the v2 data endpoint.
 * @param {object} options
 * @param {string} options.apiToken
 * @param {string} options.assetUid
 * @param {number} [options.limit=100] - Page size (max 1000).
 * @param {number} [options.start=0] - Offset for pagination.
 * @param {string|object} [options.query] - Optional MongoDB-style filter JSON.
 * @param {string} [options.apiBaseUrl]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<{ count: number, next: string|null, previous: string|null, results: object[] }>}
 */
export async function fetchKoboDataPage({
  apiToken,
  assetUid,
  limit = 100,
  start = 0,
  query,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiToken) {
    throw new TypeError("apiToken is required");
  }

  if (!assetUid) {
    throw new TypeError("assetUid is required");
  }

  assertFetchImpl(fetchImpl);

  const params = new URLSearchParams({
    limit: String(limit),
    start: String(start),
  });

  if (query !== undefined) {
    params.set("query", typeof query === "string" ? query : JSON.stringify(query));
  }

  const url = `${buildAssetDataListUrl(apiBaseUrl, assetUid)}?${params}`;

  return koboRequest(url, { apiToken, fetchImpl });
}

/**
 * Fetch all submission data, following v2 pagination until `next` is null.
 * @param {object} options
 * @param {string} options.apiToken
 * @param {string} options.assetUid
 * @param {string|object} [options.query] - Optional MongoDB-style filter JSON.
 * @param {string} [options.apiBaseUrl]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<object[]>}
 */
export async function fetchAllKoboData({
  apiToken,
  assetUid,
  query,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiToken) {
    throw new TypeError("apiToken is required");
  }

  if (!assetUid) {
    throw new TypeError("assetUid is required");
  }

  assertFetchImpl(fetchImpl);

  const params = new URLSearchParams({ limit: "1000", start: "0" });

  if (query !== undefined) {
    params.set("query", typeof query === "string" ? query : JSON.stringify(query));
  }

  const submissions = [];
  let url = `${buildAssetDataListUrl(apiBaseUrl, assetUid)}?${params}`;

  while (url) {
    const page = await koboRequest(url, { apiToken, fetchImpl });
    submissions.push(...page.results);
    url = page.next ?? null;
  }

  return submissions;
}

/**
 * Fetch a single submission by its numeric `_id` or UUID.
 * @param {object} options
 * @param {string} options.apiToken
 * @param {string} options.assetUid
 * @param {string|number} options.submissionId
 * @param {string} [options.apiBaseUrl]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<object>}
 */
export async function fetchKoboSubmission({
  apiToken,
  assetUid,
  submissionId,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiToken) {
    throw new TypeError("apiToken is required");
  }

  if (!assetUid) {
    throw new TypeError("assetUid is required");
  }

  if (submissionId === undefined || submissionId === null || submissionId === "") {
    throw new TypeError("submissionId is required");
  }

  assertFetchImpl(fetchImpl);

  const url = `${normalizeBaseUrl(apiBaseUrl)}/api/v2/assets/${encodeURIComponent(
    assetUid,
  )}/data/${encodeURIComponent(String(submissionId))}/`;

  return koboRequest(url, { apiToken, fetchImpl });
}

/**
 * Fetch asset (form) metadata from the v2 assets endpoint.
 * @param {object} options
 * @param {string} options.apiToken
 * @param {string} options.assetUid
 * @param {string} [options.apiBaseUrl]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<object>}
 */
export async function fetchKoboAsset({
  apiToken,
  assetUid,
  apiBaseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiToken) {
    throw new TypeError("apiToken is required");
  }

  if (!assetUid) {
    throw new TypeError("assetUid is required");
  }

  assertFetchImpl(fetchImpl);

  const url = `${normalizeBaseUrl(apiBaseUrl)}/api/v2/assets/${encodeURIComponent(assetUid)}/`;

  return koboRequest(url, { apiToken, fetchImpl });
}

/** Wrap flat field data in the v1 submission envelope expected by KoBoCAT. */
function buildSubmissionPayload({ assetUid, formUuid, data }) {
  const { meta, ...fields } = data;
  const metaObject = meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
  const instanceID = metaObject.instanceID ?? `uuid:${randomUUID()}`;

  return {
    id: assetUid,
    submission: {
      formhub: { uuid: formUuid },
      ...fields,
      meta: {
        ...metaObject,
        instanceID,
      },
    },
  };
}

function buildAssetDataListUrl(apiBaseUrl, assetUid) {
  return `${normalizeBaseUrl(apiBaseUrl)}/api/v2/assets/${encodeURIComponent(assetUid)}/data/`;
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

function assertFetchImpl(fetchImpl) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetch is unavailable. Use Node.js 18+ or pass fetchImpl.");
  }
}

async function koboRequest(url, { apiToken, method = "GET", body, fetchImpl }) {
  const headers = {
    Authorization: `Token ${apiToken}`,
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetchImpl(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    throw new KoboApiError(`Kobo API request failed with status ${response.status}`, {
      status: response.status,
      responseBody,
    });
  }

  return responseBody;
}

/** Read response body once; tolerate empty or non-JSON payloads instead of throwing. */
async function parseResponseBody(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
