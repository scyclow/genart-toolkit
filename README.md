# Setup

## Renderer Setup/Dev
- Create an account with Infura, get an Infura key
- Create an account with Browserless.io, get a key

- Sign up for Google Cloud Platform
- Enable GCP Cloud Function & Storage APIs
- Ask ChatGPT how to get a GCP service account key json file
- Create a `renderer/.env` file that looks something like this locally:

```
  ENV="dev"
  CONTRACT_ADDR=""
  INFURA_KEY=""
  PUPPETEER_BROWSERLESS_IO_KEY=""
  FILE_NAME=""
  BUCKET_NAME=""
  STORAGE_KEYFILE_PATH=""
```

- `cd renderer` and run `npm run start` to run the renderer locally
- Deploy the cloud function
- Remember to add all of these environment variables when deploying the cloud function
- Ask ChatGPT how to make the cloud function invoker role public