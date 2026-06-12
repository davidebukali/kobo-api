import { createKoboClient } from "../src/kobo.js";

const {
  KOBO_API_TOKEN,
  KOBO_ASSET_UID,
  KOBO_API_BASE_URL,
} = process.env;

const client = createKoboClient({
  apiToken: KOBO_API_TOKEN,
  assetUid: KOBO_ASSET_UID,
  apiBaseUrl: KOBO_API_BASE_URL,
});

try {
  const page = await client.listData({ limit: 10, start: 0 });
  console.log(`Showing ${page.results.length} of ${page.count} submissions:`);
  console.log(page.results);

  const asset = await client.getAsset();
  console.log(`Form: ${asset.name} (${asset.uid})`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
