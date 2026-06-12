import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  KoboApiError,
  createKoboClient,
  fetchAllKoboData,
  fetchKoboAsset,
  fetchKoboDataPage,
  fetchKoboSubmission,
  submitKoboData,
} from "../src/kobo.js";

describe("submitKoboData", () => {
  it("posts wrapped submission data to the v1 JSON endpoint", async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });

      return new Response(JSON.stringify({ uid: "submission-123" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await submitKoboData({
      apiToken: "secret-token",
      assetUid: "asset-123",
      formUuid: "form-uuid-456",
      data: {
        name: "Ada",
        consent: "yes",
        meta: { instanceID: "uuid:test-id" },
      },
      fetchImpl,
    });

    assert.deepEqual(result, { uid: "submission-123" });
    assert.equal(calls[0].url, "https://kc.kobotoolbox.org/api/v1/submissions.json");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[0].options.headers.Authorization, "Token secret-token");
    assert.equal(calls[0].options.headers["Content-Type"], "application/json");
    assert.equal(
      calls[0].options.body,
      JSON.stringify({
        id: "asset-123",
        submission: {
          formhub: { uuid: "form-uuid-456" },
          name: "Ada",
          consent: "yes",
          meta: { instanceID: "uuid:test-id" },
        },
      }),
    );
  });

  it("generates meta.instanceID when omitted", async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      return new Response("{}", { status: 201 });
    };

    await submitKoboData({
      apiToken: "secret-token",
      assetUid: "asset-123",
      formUuid: "form-uuid-456",
      data: { name: "Ada" },
      fetchImpl,
    });

    const payload = JSON.parse(calls[0].options.body);
    assert.match(payload.submission.meta.instanceID, /^uuid:[0-9a-f-]{36}$/);
  });

  it("throws a KoboApiError when the API response is not ok", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ detail: "Invalid submission" }), { status: 400 });

    await assert.rejects(
      submitKoboData({
        apiToken: "secret-token",
        assetUid: "asset-123",
        formUuid: "form-uuid-456",
        data: { name: "Ada" },
        fetchImpl,
      }),
      (error) => {
        assert.ok(error instanceof KoboApiError);
        assert.equal(error.status, 400);
        assert.deepEqual(error.responseBody, { detail: "Invalid submission" });
        return true;
      },
    );
  });
});

describe("fetchKoboDataPage", () => {
  it("fetches one page from the v2 data endpoint", async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });

      return new Response(
        JSON.stringify({
          count: 1,
          next: null,
          previous: null,
          results: [{ _id: 42, name: "Ada" }],
        }),
        { status: 200 },
      );
    };

    const result = await fetchKoboDataPage({
      apiToken: "secret-token",
      assetUid: "asset-123",
      limit: 50,
      start: 0,
      fetchImpl,
    });

    assert.equal(result.count, 1);
    assert.deepEqual(result.results, [{ _id: 42, name: "Ada" }]);
    assert.equal(
      calls[0].url,
      "https://kf.kobotoolbox.org/api/v2/assets/asset-123/data/?limit=50&start=0",
    );
    assert.equal(calls[0].options.method, "GET");
    assert.equal(calls[0].options.headers.Authorization, "Token secret-token");
  });
});

describe("fetchAllKoboData", () => {
  it("follows pagination until next is null", async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });

      if (calls.length === 1) {
        return new Response(
          JSON.stringify({
            count: 2,
            next: "https://kf.kobotoolbox.org/api/v2/assets/asset-123/data/?limit=1000&start=1000",
            previous: null,
            results: [{ _id: 1 }],
          }),
          { status: 200 },
        );
      }

      return new Response(
        JSON.stringify({
          count: 2,
          next: null,
          previous: "https://kf.kobotoolbox.org/api/v2/assets/asset-123/data/?limit=1000&start=0",
          results: [{ _id: 2 }],
        }),
        { status: 200 },
      );
    };

    const result = await fetchAllKoboData({
      apiToken: "secret-token",
      assetUid: "asset-123",
      fetchImpl,
    });

    assert.deepEqual(result, [{ _id: 1 }, { _id: 2 }]);
    assert.equal(calls.length, 2);
    assert.equal(
      calls[0].url,
      "https://kf.kobotoolbox.org/api/v2/assets/asset-123/data/?limit=1000&start=0",
    );
    assert.equal(
      calls[1].url,
      "https://kf.kobotoolbox.org/api/v2/assets/asset-123/data/?limit=1000&start=1000",
    );
  });
});

describe("fetchKoboSubmission", () => {
  it("fetches a single submission by id", async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });

      return new Response(JSON.stringify({ _id: 42, name: "Ada" }), { status: 200 });
    };

    const result = await fetchKoboSubmission({
      apiToken: "secret-token",
      assetUid: "asset-123",
      submissionId: 42,
      fetchImpl,
    });

    assert.deepEqual(result, { _id: 42, name: "Ada" });
    assert.equal(
      calls[0].url,
      "https://kf.kobotoolbox.org/api/v2/assets/asset-123/data/42/",
    );
  });
});

describe("fetchKoboAsset", () => {
  it("fetches asset metadata", async () => {
    const calls = [];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });

      return new Response(JSON.stringify({ uid: "asset-123", name: "Test API" }), {
        status: 200,
      });
    };

    const result = await fetchKoboAsset({
      apiToken: "secret-token",
      assetUid: "asset-123",
      fetchImpl,
    });

    assert.deepEqual(result, { uid: "asset-123", name: "Test API" });
    assert.equal(calls[0].url, "https://kf.kobotoolbox.org/api/v2/assets/asset-123/");
  });
});

describe("createKoboClient", () => {
  it("creates a reusable client configured for one asset", async () => {
    const fetchImpl = async () => new Response("{}", { status: 201 });
    const client = createKoboClient({
      apiToken: "secret-token",
      assetUid: "asset-123",
      formUuid: "form-uuid-456",
      fetchImpl,
    });

    const result = await client.submitData({ name: "Ada" });

    assert.deepEqual(result, {});
  });

  it("exposes read helpers on the client", async () => {
    const fetchImpl = async (url) => {
      if (url.endsWith("/data/?limit=100&start=0")) {
        return new Response(
          JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
          { status: 200 },
        );
      }

      if (url.endsWith("/data/99/")) {
        return new Response(JSON.stringify({ _id: 99 }), { status: 200 });
      }

      if (url.endsWith("/asset-123/")) {
        return new Response(JSON.stringify({ uid: "asset-123" }), { status: 200 });
      }

      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    };

    const client = createKoboClient({
      apiToken: "secret-token",
      assetUid: "asset-123",
      fetchImpl,
    });

    const page = await client.listData();
    const submission = await client.getSubmission(99);
    const asset = await client.getAsset();

    assert.deepEqual(page.results, []);
    assert.deepEqual(submission, { _id: 99 });
    assert.deepEqual(asset, { uid: "asset-123" });
  });

  it("requires formUuid for submitData", () => {
    const client = createKoboClient({
      apiToken: "secret-token",
      assetUid: "asset-123",
      fetchImpl: async () => new Response("{}", { status: 201 }),
    });

    assert.throws(() => client.submitData({ name: "Ada" }), /formUuid is required/);
  });
});
