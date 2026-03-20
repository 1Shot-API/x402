import { config } from "dotenv";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { create1ShotAPIFacilitatorClient } from "@1shotapi/x402-facilitator";

config();

const evmAddress = process.env.EVM_ADDRESS as `0x${string}`;
if (!evmAddress) {
  console.error("Missing required environment variable: EVM_ADDRESS");
  process.exit(1);
}

const apiKey = process.env.ONESHOT_API_KEY;
const apiSecret = process.env.ONESHOT_API_SECRET;
if (!apiKey || !apiSecret) {
  console.error("Missing required environment variables: ONESHOT_API_KEY and ONESHOT_API_SECRET");
  process.exit(1);
}

const facilitatorClient = create1ShotAPIFacilitatorClient({ apiKey, apiSecret });
const app = express();

// Allow browser clients to call this API from any origin.
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const requestHeaders = req.headers["access-control-request-headers"];

  res.setHeader("Access-Control-Allow-Origin", requestOrigin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Payment-Required, payment-required, X-PAYMENT-RESPONSE, PAYMENT-RESPONSE, X-PAYMENT-HEADER, PAYMENT-HEADER",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    typeof requestHeaders === "string"
      ? requestHeaders
      : "Content-Type, Authorization, X-PAYMENT, PAYMENT-SIGNATURE",
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

app.use(
  paymentMiddleware(
    {
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
    },
    new x402ResourceServer(facilitatorClient).register("eip155:8453", new ExactEvmScheme()),
  ),
);

app.get("/weather", (_, res) => {
  res.send({
    report: {
      weather: "sunny",
      temperature: 70,
    },
  });
});

app.listen(4021, () => {
  console.log(`Server listening at http://localhost:${4021}`);
});
