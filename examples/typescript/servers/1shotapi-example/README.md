# @x402/express 1Shot API Example Server

Express.js server demonstrating how to protect API endpoints with a paywall using `@x402/express` and the 1Shot API facilitator client.

```typescript
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { create1ShotAPIFacilitatorClient } from "@1shotapi/x402-facilitator";

const app = express();
const facilitatorClient = create1ShotAPIFacilitatorClient({
  apiKey: process.env.ONESHOT_API_KEY,
  apiSecret: process.env.ONESHOT_API_SECRET,
});

app.use(
  paymentMiddleware(
    {
      "GET /weather": {
        accepts: { scheme: "exact", price: "$0.001", network: "eip155:84532", payTo: evmAddress },
        description: "Weather data",
        mimeType: "application/json",
      },
    },
    new x402ResourceServer(facilitatorClient).register("eip155:84532", new ExactEvmScheme()),
  ),
);
```

## Prerequisites

- Node.js v20+ (install via [nvm](https://github.com/nvm-sh/nvm))
- pnpm v10 (install via [pnpm.io/installation](https://pnpm.io/installation))
- Valid EVM address for receiving payments
- 1Shot API credentials

## Setup

1. Copy `.env-local` to `.env`:

```bash
cp .env-local .env
```

Then fill:

- `ONESHOT_API_KEY`
- `ONESHOT_API_SECRET`
- `EVM_ADDRESS`

2. Install and build all packages from the TypeScript examples root:

```bash
cd ../../
pnpm install && pnpm build
cd servers/1shotapi-example
```

The example imports `@1shotapi/x402-facilitator`, which loads compiled output from that package’s `dist/` folder. A full `pnpm build` builds it along with other workspace packages. If you see a runtime error like missing export `create1ShotAPIFacilitatorClient`, rebuild the facilitator only:

```bash
cd ../../   # examples/typescript
pnpm build --filter @1shotapi/x402-facilitator
```

3. Run the server:

```bash
pnpm dev
```

## Testing the Server

Use one of the example clients:

```bash
cd ../../clients/fetch
pnpm dev
```

or

```bash
cd ../../clients/axios
pnpm dev
```

## Example Endpoint

`/weather` requires a payment of 0.001 USDC on Base Sepolia and returns a simple weather report.
