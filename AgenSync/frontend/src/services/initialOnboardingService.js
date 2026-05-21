import {
  completeOnboardingApi,
  getOnboardingStatusApi,
  saveOnboardingBusinessApi,
  saveOnboardingClientsApi,
  saveOnboardingProfessionalsApi,
  saveOnboardingServicesApi,
  saveOnboardingTypeApi
} from "../api/modules/onboardingApi.js";

export function getInitialOnboardingStatus() {
  return getOnboardingStatusApi();
}

export function saveInitialBusiness(payload) {
  return saveOnboardingBusinessApi(payload);
}

export function saveInitialBusinessType(payload) {
  return saveOnboardingTypeApi(payload);
}

export function saveInitialServices(payload) {
  return saveOnboardingServicesApi(payload);
}

export function saveInitialProfessionals(payload) {
  return saveOnboardingProfessionalsApi(payload);
}

export function saveInitialClients(payload) {
  return saveOnboardingClientsApi(payload);
}

export function completeInitialOnboarding() {
  return completeOnboardingApi();
}
