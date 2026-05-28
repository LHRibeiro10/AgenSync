import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function getOnboardingStatusApi() {
  return httpClient.get(endpoints.onboarding.status, { cacheTtlMs: 60000 });
}

export function saveOnboardingBusinessApi(payload) {
  return httpClient.post(endpoints.onboarding.business, { body: payload });
}

export function saveOnboardingTypeApi(payload) {
  return httpClient.post(endpoints.onboarding.type, { body: payload });
}

export function saveOnboardingServicesApi(payload) {
  return httpClient.post(endpoints.onboarding.services, { body: payload });
}

export function saveOnboardingProfessionalsApi(payload) {
  return httpClient.post(endpoints.onboarding.professionals, { body: payload });
}

export function saveOnboardingClientsApi(payload) {
  return httpClient.post(endpoints.onboarding.clients, { body: payload });
}

export function completeOnboardingApi() {
  return httpClient.post(endpoints.onboarding.complete);
}
