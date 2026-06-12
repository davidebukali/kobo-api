import { createKoboClient } from "./kobo.js";

const client = createKoboClient({
  apiToken: process.env.KOBO_API_TOKEN,
  assetUid: process.env.KOBO_ASSET_UID,
  formUuid: process.env.KOBO_FORM_UUID,
  submissionBaseUrl: process.env.KOBO_SUBMISSION_BASE_URL,
});

const result = await client.submitData({
  What_is_an_API_: "Respondent",
  How_many_requests_will_this_handle_: 50,
  Describe_what_it_is_: "respondents will be able to submit data to the form",
});

console.log(result);
