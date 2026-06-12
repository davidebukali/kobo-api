import { randomUUID } from "node:crypto";

/** Default KoBoCAT host for v1 JSON submissions. Use `kc-eu.kobotoolbox.org` for EU projects. */
const DEFAULT_SUBMISSION_BASE_URL = "https://kc.kobotoolbox.org";

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
 * Prefer this over calling `submitKoboData` directly when submitting many records to the same form.
 */
export function createKoboClient({
  apiToken,
  assetUid,
  formUuid,
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

  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetch is unavailable. Use Node.js 18+ or pass fetchImpl.");
  }

  const apiBaseUrl = submissionBaseUrl.replace(/\/+$/, "");

  return {
    submitData(data) {
      return submitKoboData({
        apiToken,
        assetUid,
        formUuid,
        submissionBaseUrl: apiBaseUrl,
        data,
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

  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetch is unavailable. Use Node.js 18+ or pass fetchImpl.");
  }

  const url = `${submissionBaseUrl.replace(/\/+$/, "")}/api/v1/submissions.json`;
  const payload = buildSubmissionPayload({ assetUid, formUuid, data });

  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
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
