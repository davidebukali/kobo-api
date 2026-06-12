# Kobo API Submitter

Minimal JavaScript project for submitting data to a KoboToolbox form through the API.

## Requirements

- Node.js 18 or newer
- Kobo API token
- Kobo form asset UID

## Setup

```sh
cp .env.example .env
```

Fill in `.env` with your Kobo values, then export them before running the example:

```sh
export KOBO_API_TOKEN="your_kobo_api_token"
export KOBO_ASSET_UID="your_form_asset_uid"
export KOBO_BASE_URL="https://kf.kobotoolbox.org"
npm start
```

For EU-hosted Kobo projects, use:

```sh
export KOBO_BASE_URL="https://eu.kobotoolbox.org"
```

## Usage

```js
import { createKoboClient } from "./src/kobo.js";

const client = createKoboClient({
  apiToken: process.env.KOBO_API_TOKEN,
  assetUid: process.env.KOBO_ASSET_UID,
});

const result = await client.submitData({
  name: "Example respondent",
  age: 30,
  consent: "yes",
});

console.log(result);
```

The object passed to `submitData` must use the field names from your deployed Kobo form.

## Test

```sh
npm test
```
