import { createKoboClient } from "../src/kobo.js";

const {
  KOBO_API_TOKEN,
  KOBO_ASSET_UID,
  KOBO_FORM_UUID,
  KOBO_SUBMISSION_BASE_URL,
} = process.env;

const client = createKoboClient({
  apiToken: KOBO_API_TOKEN,
  assetUid: KOBO_ASSET_UID,
  formUuid: KOBO_FORM_UUID,
  submissionBaseUrl: KOBO_SUBMISSION_BASE_URL,
});

const submission = {
  name: "Example respondent",
  age: 30,
  consent: "yes",
};

try {
  const result = await client.submitData(submission);
  console.log("Submission accepted:", result);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
