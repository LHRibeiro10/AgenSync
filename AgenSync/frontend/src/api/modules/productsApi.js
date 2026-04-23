import { endpoints } from "../endpoints.js";
import { httpClient } from "../httpClient.js";

export function listProductsApi(params) {
  return httpClient.get(endpoints.products.list, { params, cacheTtlMs: 30_000 });
}

export function createProductApi(payload) {
  return httpClient.post(endpoints.products.list, { body: payload });
}

export function updateProductApi(productId, payload) {
  return httpClient.put(endpoints.products.byId(productId), { body: payload });
}

export function deleteProductApi(productId) {
  return httpClient.delete(endpoints.products.byId(productId));
}

export function listSalesApi(params) {
  return httpClient.get(endpoints.sales.list, { params, cacheTtlMs: 10_000 });
}

export function createSaleApi(payload) {
  return httpClient.post(endpoints.sales.list, { body: payload });
}
