import {
  createProductApi,
  createSaleApi,
  deleteProductApi,
  listProductsApi,
  listSalesApi,
  updateProductApi
} from "../api/modules/productsApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";
import * as productsMock from "../mocks/legacy/productsMock.js";

function asList(value, key) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.[key])) return value[key];
  return [];
}

function asItem(value, key) {
  if (value?.[key]) return value[key];
  return value;
}

export const productCategories = productsMock.productCategories;
export const productCategoryLabel = productsMock.productCategoryLabel;
export const stockStatus = productsMock.stockStatus;

export async function listProducts(filters = {}) {
  const response = await executeDataSource({
    feature: "products.list",
    remote: () => listProductsApi(filters),
    mock: () => productsMock.listProducts(filters)
  });
  return asList(response, "products");
}

export async function createProduct(payload) {
  const response = await executeDataSource({
    feature: "products.create",
    remote: () => createProductApi(payload),
    mock: () => productsMock.createProduct(payload)
  });
  return asItem(response, "product");
}

export async function updateProduct(productId, payload) {
  const response = await executeDataSource({
    feature: "products.update",
    remote: () => updateProductApi(productId, payload),
    mock: () => productsMock.updateProduct(productId, payload)
  });
  return asItem(response, "product");
}

export async function deleteProduct(productId) {
  return executeDataSource({
    feature: "products.delete",
    remote: () => deleteProductApi(productId),
    mock: () => productsMock.deleteProduct(productId)
  });
}

export async function toggleProduct(productId) {
  const products = await listProducts();
  const product = products.find((item) => item.id === productId);
  if (!product) {
    throw new Error("Produto nao encontrado.");
  }

  return updateProduct(productId, { ...product, isActive: !product.isActive });
}

export async function createProductSale(payload) {
  const response = await executeDataSource({
    feature: "sales.create",
    remote: () => createSaleApi(payload),
    mock: () => productsMock.createProductSale(payload)
  });
  return asItem(response, "sale");
}

export async function listProductSales(filters = {}) {
  const response = await executeDataSource({
    feature: "sales.list",
    remote: () => listSalesApi(filters),
    mock: () => productsMock.listProductSales(filters)
  });
  return asList(response, "sales");
}

export function sumProductSales(sales) {
  return productsMock.sumProductSales(sales);
}

export function productSalesProfit(sales) {
  return productsMock.productSalesProfit(sales);
}
