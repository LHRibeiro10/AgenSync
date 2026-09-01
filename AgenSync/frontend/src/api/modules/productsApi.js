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

export function listProductStockMovementsApi(productId) {
  return httpClient.get(endpoints.products.stockMovements(productId));
}

export function createProductStockMovementApi(productId, payload) {
  return httpClient.post(endpoints.products.stockMovements(productId), { body: payload });
}

export function listProductVariantsApi(productId) {
  return httpClient.get(endpoints.products.variants(productId));
}

export function createProductVariantApi(productId, payload) {
  return httpClient.post(endpoints.products.variants(productId), { body: payload });
}

export function deleteProductVariantApi(productId, variantId) {
  return httpClient.delete(endpoints.products.variantById(productId, variantId));
}

export function listSalesApi(params) {
  return httpClient.get(endpoints.sales.list, { params, cacheTtlMs: 30000 });
}

export function salesOverviewApi(params) {
  return httpClient.get(endpoints.sales.overview, { params, cacheTtlMs: 30000 });
}

export function createSaleApi(payload) {
  return httpClient.post(endpoints.sales.list, { body: payload });
}
