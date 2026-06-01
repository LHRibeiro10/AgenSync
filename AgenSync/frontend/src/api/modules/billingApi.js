import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function getBillingStatusApi() {
  return httpClient.get(endpoints.billing.status, { cacheTtlMs: 30_000 });
}

export function createBillingCheckoutSessionApi(payload) {
  return httpClient.post(endpoints.billing.checkoutSession, { body: payload });
}

export function createBillingPortalSessionApi() {
  return httpClient.post(endpoints.billing.portalSession);
}
