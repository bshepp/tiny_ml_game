# Roshambot telemetry infrastructure

Anonymous round telemetry for the Rock Paper Scissors learning game. AWS Lambda
Function URL backed by a DynamoDB table, deployed with Terraform.

## What gets stored

For every round (only when the player accepted the in-app consent banner):

```
playerMove   "Rock" | "Paper" | "Scissors"
aiMove       "Rock" | "Paper" | "Scissors"
result       "win"  | "loss"  | "tie"        (from the player's perspective)
strategy     "random" | "counter" | "pattern" | "learning"
modelArch    "dense" | "gru" | "transformer"
sessionId    random per-browser UUID         (no IP, no fingerprint)
sequence     last 6 rounds (move/move/result triples)
ts           ISO timestamp
ttl          unix seconds, 90 days from write (DynamoDB auto-expires)
```

No IP, no user agent, no account, no cookies.

## Deploy

```sh
cd infra
# install Lambda deps so they get bundled into the zip
cd lambda && npm install --omit=dev && cd ..

terraform init
terraform apply
```

Then take the `function_url` output and either:

1. Bake it into the production build:
   ```sh
   REACT_APP_TELEMETRY_URL=https://<id>.lambda-url.us-east-1.on.aws npm run build
   ```
2. Or commit it to `.env.production` (it's a public endpoint anyway).

## Tear down

```sh
terraform destroy
```

The DynamoDB table is deleted with all data. There is no S3 backup.

## API

* `POST /round` — body: a single round object as above (≤ 8 KB). Strictly
  validated: enum fields, `sessionId` limited to `[A-Za-z0-9_-]{1,64}`,
  `sequence` ≤ 10 entries each exactly `{playerMove, aiMove, result}`.
  Returns 204; 400 on validation failure; 413 if oversized.
* `GET  /stats` — returns aggregated counts for the last 7 days.

Validation unit tests: `cd lambda && node --test`.

CORS is restricted to `https://roshambot.briansheppard.com` and
`http://localhost:3000` by default; edit `allowed_origins` in `main.tf` to add
more.

## Cost

DynamoDB is on-demand billing; Lambda is pay-per-invoke. At hobby traffic levels
this should comfortably fit inside the AWS free tier. The TTL keeps the table
from growing unbounded, and `reserved_concurrent_executions = 10` bounds
worst-case spend on this public, unauthenticated endpoint.
