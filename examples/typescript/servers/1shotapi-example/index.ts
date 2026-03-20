import { config } from "dotenv";
import express from "express";
import {
  paymentMiddlewareFromHTTPServer,
  x402HTTPResourceServer,
  x402ResourceServer,
} from "@x402/express";
import type { HTTPRequestContext, RouteConfig, RoutesConfig } from "@x402/core/server";
import { decodePaymentSignatureHeader } from "@x402/core/http";
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

// Log every request to /weather (OPTIONS preflight, 402, paid GET, etc.) and final status.
app.use((req, res, next) => {
  if (req.path === "/weather" || req.path.startsWith("/weather/")) {
    console.log(
      `[weather] ${new Date().toISOString()} ${req.method} ${req.originalUrl} origin=${req.headers.origin ?? "none"}`,
    );
    res.on("finish", () => {
      console.log(`[weather] -> response status ${res.statusCode}`);
    });
  }
  next();
});

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

const routes = {
  "GET /weather": {
    accepts: {
      scheme: "exact",
      price: "$0.01",
      network: "eip155:8453" as const,
      payTo: evmAddress,
    },
    description: "Weather data",
    mimeType: "application/json",
  },
} satisfies RoutesConfig;

const resourceServer = new x402ResourceServer(facilitatorClient)
  .register("eip155:8453", new ExactEvmScheme())
  .onAfterVerify(async ctx => {
    const { result } = ctx;
    const detail = result.isValid
      ? ""
      : [result.invalidReason, result.invalidMessage].filter(Boolean).join(" — ");
    console.log(`[x402] facilitator verify:`, result.isValid ? "valid" : "invalid", detail);
  })
  .onVerifyFailure(async ctx => {
    console.error("[x402] facilitator verify threw:", ctx.error);
    return undefined;
  });

const httpServer = new x402HTTPResourceServer(resourceServer, routes).onProtectedRequest(
  async (ctx: HTTPRequestContext, _: RouteConfig) => {
    const paySig =
      ctx.adapter.getHeader("payment-signature") || ctx.adapter.getHeader("PAYMENT-SIGNATURE");
    const xPay = ctx.adapter.getHeader("x-payment") || ctx.adapter.getHeader("X-PAYMENT");
    console.log(
      `[x402] ${ctx.method} ${ctx.path}: Payment-Signature=${paySig ? `present (${paySig.length} chars)` : "absent"}, X-Payment=${xPay ? `present (${xPay.length} chars)` : "absent"}`,
    );
    if (xPay && !paySig) {
      console.warn(
        "[x402] Only the Payment-Signature header is used for v2 payments; X-Payment is ignored. Send base64-encoded JSON in Payment-Signature on the retry request.",
      );
    }
    if (!paySig && !xPay) {
      console.log(
        "[x402] No payment header on retry — expect 402 until Payment-Signature is sent.",
      );
    }

    // v2: 402 with a valid header usually means paymentPayload.accepted !== server requirements, or verify failed.
    if (paySig) {
      try {
        const payload = decodePaymentSignatureHeader(paySig);
        const weatherAccepts = routes["GET /weather"].accepts;
        const paymentOptions = Array.isArray(weatherAccepts) ? weatherAccepts : [weatherAccepts];
        const expected = await resourceServer.buildPaymentRequirementsFromOptions(
          paymentOptions,
          ctx,
        );
        const match = resourceServer.findMatchingRequirements(expected, payload);
        console.log(`[x402] decoded x402Version=${payload.x402Version}`);
        console.log("[x402] paymentPayload.accepted:", JSON.stringify(payload.accepted, null, 2));
        console.log(
          "[x402] server requirement(s) for this route:",
          JSON.stringify(expected, null, 2),
        );
        console.log(
          match
            ? "[x402] accepted matches route (deepEqual) — if still 402, facilitator rejected verify"
            : "[x402] NO MATCH: paymentPayload.accepted must deepEqual the requirement from PAYMENT-REQUIRED; rebuild payment from the latest 402 response.",
        );
        if (!match && expected[0] && payload.accepted) {
          const want = JSON.stringify((expected[0] as { extra?: unknown }).extra ?? {});
          const got = JSON.stringify((payload.accepted as { extra?: unknown }).extra ?? {});
          if (want !== got) {
            console.warn(
              "[x402] Mismatch detail: `extra` differs (client vs server). Do not hand-roll `accepted`; set it to the exact object from `accepts[]` in the decoded PAYMENT-REQUIRED response (Exact EVM adds token metadata under `extra`).",
            );
          }
        }
      } catch (e) {
        console.warn(
          "[x402] Payment-Signature present but not decodable as v2 payload (bad base64 or wrong shape):",
          e,
        );
      }
    }
    return undefined;
  },
);

app.use(paymentMiddlewareFromHTTPServer(httpServer));

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
