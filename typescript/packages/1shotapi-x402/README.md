# @1shotapi/x402-facilitator

The official [1Shot API](https://1shotapi.com) facilitator package for the x402 Payment Protocol. This package enables you to integrate x402 payments into your server via 1Shot API's managed facilitator service, enabling seamless payment verification and settlement.

Check out the 1Shot API [x402 documentation](https://docs.1shotapi.com/x402/index.html) and install the 1Shot API [skill package](https://github.com/1Shot-API/skills) for building with agentic coding tools. 

## Setting up your 1Shot API Account

1. Create a free account at https://1shotapi.com
2. Create a server wallet on the network you want to process payments on & deposit gas tokens.
3. Import the `transferWithAuthorization` method for your target payment token. 

## Installation

```bash
npm install @1shotapi/x402-facilitator
```

For an Express server using the x402 resource server stack, you will also need `@x402/express`, `@x402/core`, and `@x402/evm` (or your chain’s server package) as shown in the example below.

## Environment Variables

This package uses API keys from the [1Shot API](https://1shotapi.com) service for authenticated operations:

- `ONESHOT_API_KEY`: Your 1Shot API key
- `ONESHOT_API_SECRET`: Your 1Shot API secret

You can set these in the environment, or pass `apiKey` / `apiSecret` into `create1ShotAPIFacilitatorClient` (or `createFacilitatorConfig` / `create1ShotAPIAuthHeaders`) explicitly.

### Endpoint Authentication Requirements

| Endpoint    | Authentication Required | Purpose                                             |
| ----------- | ----------------------- | --------------------------------------------------- |
| `list`      | ❌ No                   | Discover available bazaar items and payment options |
| `verify`    | ✅ Yes                  | Verify payment transactions                         |
| `settle`    | ✅ Yes                  | Settle completed payments                           |
| `supported` | ✅ Yes                  | List active chains in your 1Shot API organization   |

**Note:** an API key/secret is required to use `supported`, `verify` and `settle` endpoints. 1Shot API does not currently support `list`.

## Quick Start

Use **`create1ShotAPIFacilitatorClient`** when wiring the facilitator into **`x402ResourceServer`** (the pattern used by the official Express integration):

```typescript
import express from "express";
import {
  paymentMiddlewareFromHTTPServer,
  x402HTTPResourceServer,
  x402ResourceServer,
} from "@x402/express";
import type { RoutesConfig } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { create1ShotAPIFacilitatorClient } from "@1shotapi/x402-facilitator";

const evmAddress = process.env.EVM_ADDRESS as `0x${string}`;
const facilitatorClient = create1ShotAPIFacilitatorClient({
  apiKey: process.env.ONESHOT_API_KEY,
  apiSecret: process.env.ONESHOT_API_SECRET,
});

const routes = {
  "GET /weather": {
    accepts: {
      scheme: "exact",
      price: "$0.01",
      network: "eip155:8453",
      payTo: evmAddress,
    },
    description: "Weather data",
    mimeType: "application/json",
  },
} satisfies RoutesConfig;

const resourceServer = new x402ResourceServer(facilitatorClient)
  .register("eip155:8453", new ExactEvmScheme());

const httpServer = new x402HTTPResourceServer(resourceServer, routes);

const app = express();
app.use(paymentMiddlewareFromHTTPServer(httpServer));

app.get("/weather", (_, res) => {
  res.send({ report: { weather: "sunny", temperature: 70 } });
});

app.listen(4021);
```

A full runnable server (CORS, optional logging hooks, and `onProtectedRequest` debugging) lives in **`examples/typescript/servers/1shotapi-example/index.ts`** in this repository.

### Alternative: facilitator config only

If your stack expects a **`FacilitatorConfig`** (URL + auth) instead of a **`FacilitatorClient`**, use the default export or **`createFacilitatorConfig`**:

```typescript
import { facilitator, createFacilitatorConfig } from "@1shotapi/x402-facilitator";

// Reads ONESHOT_API_KEY / ONESHOT_API_SECRET from the environment
const fromEnv = createFacilitatorConfig();

// Or pass credentials directly
const fromSecrets = createFacilitatorConfig("your-api-key", "your-api-secret");
```

The pre-built **`facilitator`** constant is `createFacilitatorConfig()` with no arguments (same env resolution as above).
