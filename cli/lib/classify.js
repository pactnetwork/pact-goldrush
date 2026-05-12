// lib/classify.js — success/failure classifier for a GoldRush call.
//
// Mirrors the @q3labs/pact-monitor outcome model (ok / client_error /
// server_error) plus a body check, because "200 with a useless body" is a real
// GoldRush failure mode. See SPEC §4.
//
// Returns: { classification, refund, reason }
//   classification: success | timeout | server_error | payment_failed
//                 | client_error | provider_error | schema_error
//   refund: boolean — true => Pact refunds principal + premium
//   reason: short human string for the trail

export function classify(call) {
  // transport-level failures
  if (call.transportError === "timeout") {
    return { classification: "timeout", refund: true, reason: "request timed out" };
  }
  if (call.transportError) {
    return { classification: "timeout", refund: true, reason: `transport error: ${call.transportError}` };
  }

  const s = call.httpStatus;

  if (s === 402) {
    // The agent (or facilitator) couldn't satisfy the x402 challenge — wrong
    // tier, no funded wallet, etc. From the agent's POV: paid for data, got none.
    const pr = call.paymentRequired;
    const where = pr ? `${pr.network} ${pr.amountUsdc} ${pr.raw?.accepts?.[0]?.extra?.name || "USDC"}` : "x402";
    return { classification: "payment_failed", refund: true, reason: `402 not satisfied (${where})` };
  }
  if (s >= 500) {
    return { classification: "server_error", refund: true, reason: `upstream ${s}` };
  }
  if (s >= 400) {
    // 4xx — bad/unknown chain (404), malformed address (400), etc. For this
    // RETAIL coverage product we refund 4xx too (see SPEC §4 note).
    return { classification: "client_error", refund: true, reason: `request rejected ${s}` };
  }

  // 2xx — inspect the body
  const body = call.body || {};
  if (body._nonJson != null) {
    return { classification: "schema_error", refund: true, reason: "200 but body is not JSON" };
  }
  // GoldRush envelope: { data, error, error_message, error_code }
  if (body.error === true || body.error_code != null) {
    return { classification: "provider_error", refund: true, reason: `provider error: ${body.error_message || body.error_code}` };
  }
  // schema check — `data` present, and for portfolio/activity an `items` array
  if (body.data == null) {
    return { classification: "schema_error", refund: true, reason: "200 but `data` is missing/null" };
  }
  if (body.data.items != null && !Array.isArray(body.data.items)) {
    return { classification: "schema_error", refund: true, reason: "200 but `data.items` is not an array" };
  }

  return { classification: "success", refund: false, reason: "200, schema OK" };
}
