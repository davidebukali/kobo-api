import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KoboApiError, createKoboClient, submitKoboData } from "../src/kobo.js";

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
});
