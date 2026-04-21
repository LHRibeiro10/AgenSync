import {
  createProductApi,
  createSaleApi,
  deleteProductApi,
  listProductsApi,
  listSalesApi,
  updateProductApi
} from "../api/modules/productsApi.js";
import { executeDataSource } from "./helpers/serviceMode.js";

export const productCategories = [
  { value: "cosmeticos", label: "Cosmeticos" },
  { value: "cuidados", label: "Cuidados" },
  { value: "acessorios", label: "Acessorios" },
  { value: "finalizadores", label: "Finalizadores" },
  { value: "kits", label: "Kits" },
  { value: "outros", label: "Outros" }
];

function asList(value, key) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.[key])) return value[key];
  return [];
}

function asItem(value, key) {
  if (value?.[key]) return value[key];
  return value;
}

export function productCategoryLabel(value) {
  return productCategories.find((category) => category.value === value)?.label || value;
}

export function stockStatus(product) {
  if (Number(product.stockQty) <= 0) return "out";
  if (Number(product.stockQty) <= Number(product.minStock)) return "low";
  return "ok";
}

export async function listProducts(filters = {}) {
  const response = await executeDataSource({
    feature: "products.list",
    remote: () => listProductsApi(filters)
  });
  return asList(response, "products");
}

export async function createProduct(payload) {
  const response = await executeDataSource({
    feature: "products.create",
    remote: () => createProductApi(payload)
  });
  return asItem(response, "product");
}

export async function updateProduct(productId, payload) {
  const response = await executeDataSource({
    feature: "products.update",
    remote: () => updateProductApi(productId, payload)
  });
  return asItem(response, "product");
}

export async function deleteProduct(productId) {
  return executeDataSource({
    feature: "products.delete",
    remote: () => deleteProductApi(productId)
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
    remote: () => createSaleApi(payload)
  });
  return asItem(response, "sale");
}

export async function listProductSales(filters = {}) {
  const response = await executeDataSource({
    feature: "sales.list",
    remote: () => listSalesApi(filters)
  });
  return asList(response, "sales");
}

export function sumProductSales(sales) {
  return sales.reduce((total, sale) => total + Number(sale.total || 0), 0);
}

export function productSalesProfit(sales) {
  return sales.reduce(
    (total, sale) => total + (Number(sale.unitPrice || 0) - Number(sale.unitCost || 0)) * Number(sale.quantity || 0),
    0
  );
}
