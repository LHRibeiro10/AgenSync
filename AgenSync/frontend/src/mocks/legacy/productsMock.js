const PRODUCTS_KEY = "agensync_local_products_v1";
const SALES_KEY = "agensync_local_product_sales_v1";

export const productCategories = [
  { value: "cosmeticos", label: "Cosméticos" },
  { value: "cuidados", label: "Cuidados" },
  { value: "acessorios", label: "Acessórios" },
  { value: "finalizadores", label: "Finalizadores" },
  { value: "kits", label: "Kits" },
  { value: "outros", label: "Outros" }
];

const pad = (value) => String(value).padStart(2, "0");

function formatInputDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function id(prefix) {
  if (window.crypto?.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function seedProducts() {
  const createdAt = new Date().toISOString();

  return [
    {
      id: "product_oil",
      name: "Óleo finalizador",
      category: "finalizadores",
      costPrice: 24,
      salePrice: 49,
      stockQty: 8,
      minStock: 3,
      description: "Produto de finalização para venda no balcão.",
      isActive: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "product_hydration",
      name: "Máscara de hidratação",
      category: "cuidados",
      costPrice: 38,
      salePrice: 79,
      stockQty: 2,
      minStock: 3,
      description: "Estoque baixo para estimular reposição.",
      isActive: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "product_lash_shampoo",
      name: "Shampoo para cílios",
      category: "cosmeticos",
      costPrice: 18,
      salePrice: 39,
      stockQty: 0,
      minStock: 2,
      description: "Sem estoque no momento.",
      isActive: true,
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "product_kit",
      name: "Kit manutenção home care",
      category: "kits",
      costPrice: 55,
      salePrice: 119,
      stockQty: 5,
      minStock: 2,
      description: "",
      isActive: true,
      createdAt,
      updatedAt: createdAt
    }
  ];
}

function seedSales() {
  const now = new Date();
  const today = formatInputDate(now);
  const yesterday = formatInputDate(addDays(now, -1));
  const threeDaysAgo = formatInputDate(addDays(now, -3));
  const createdAt = new Date().toISOString();

  return [
    {
      id: "sale_today_oil",
      productId: "product_oil",
      productName: "Óleo finalizador",
      unitPrice: 49,
      unitCost: 24,
      quantity: 1,
      total: 49,
      date: today,
      clientId: "client_maria",
      clientName: "Maria Oliveira",
      notes: "Venda junto ao atendimento.",
      createdAt
    },
    {
      id: "sale_yesterday_kit",
      productId: "product_kit",
      productName: "Kit manutenção home care",
      unitPrice: 119,
      unitCost: 55,
      quantity: 1,
      total: 119,
      date: yesterday,
      clientId: "client_luiza",
      clientName: "Luiza Martins",
      notes: "",
      createdAt
    },
    {
      id: "sale_three_days_mask",
      productId: "product_hydration",
      productName: "Máscara de hidratação",
      unitPrice: 79,
      unitCost: 38,
      quantity: 1,
      total: 79,
      date: threeDaysAgo,
      clientId: "",
      clientName: "",
      notes: "Venda avulsa.",
      createdAt
    }
  ];
}

function readProducts() {
  const raw = localStorage.getItem(PRODUCTS_KEY);
  if (!raw) {
    const seeded = seedProducts();
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const products = JSON.parse(raw);
    if (!Array.isArray(products)) throw new Error("invalid");
    return products;
  } catch {
    const seeded = seedProducts();
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writeProducts(products) {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}

function readSales() {
  const raw = localStorage.getItem(SALES_KEY);
  if (!raw) {
    const seeded = seedSales();
    localStorage.setItem(SALES_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const sales = JSON.parse(raw);
    if (!Array.isArray(sales)) throw new Error("invalid");
    return sales;
  } catch {
    const seeded = seedSales();
    localStorage.setItem(SALES_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writeSales(sales) {
  localStorage.setItem(SALES_KEY, JSON.stringify(sales));
}

function publicProduct(product) {
  return {
    ...product,
    costPrice: Number(product.costPrice || 0),
    salePrice: Number(product.salePrice || 0),
    stockQty: Number(product.stockQty || 0),
    minStock: Number(product.minStock || 0),
    description: product.description || "",
    isActive: product.isActive !== false
  };
}

function publicSale(sale) {
  return {
    ...sale,
    unitPrice: Number(sale.unitPrice || 0),
    unitCost: Number(sale.unitCost || 0),
    quantity: Number(sale.quantity || 0),
    total: Number(sale.total || 0),
    notes: sale.notes || "",
    clientName: sale.clientName || ""
  };
}

function validateProduct(payload) {
  if (!String(payload.name || "").trim()) throw new Error("Nome do produto é obrigatório.");
  if (!String(payload.category || "").trim()) throw new Error("Categoria é obrigatória.");
  const costPrice = Number(payload.costPrice);
  const salePrice = Number(payload.salePrice);
  const stockQty = Number(payload.stockQty);
  const minStock = Number(payload.minStock);
  if (!Number.isFinite(costPrice) || costPrice < 0) throw new Error("Preço de custo inválido.");
  if (!Number.isFinite(salePrice) || salePrice < 0) throw new Error("Preço de venda inválido.");
  if (!Number.isInteger(stockQty) || stockQty < 0) throw new Error("Estoque deve ser um número inteiro maior ou igual a zero.");
  if (!Number.isInteger(minStock) || minStock < 0) throw new Error("Estoque mínimo deve ser um número inteiro maior ou igual a zero.");
}

export function productCategoryLabel(value) {
  return productCategories.find((category) => category.value === value)?.label || value;
}

export function stockStatus(product) {
  if (Number(product.stockQty) <= 0) return "out";
  if (Number(product.stockQty) <= Number(product.minStock)) return "low";
  return "ok";
}

export function listProducts(filters = {}) {
  return readProducts()
    .map(publicProduct)
    .filter((product) => !filters.activeOnly || product.isActive)
    .filter((product) => !filters.category || product.category === filters.category)
    .filter((product) => {
      if (filters.stock === "low") return stockStatus(product) === "low";
      if (filters.stock === "out") return stockStatus(product) === "out";
      if (filters.stock === "attention") return ["low", "out"].includes(stockStatus(product));
      return true;
    })
    .filter((product) => {
      const search = String(filters.search || "").trim().toLowerCase();
      if (!search) return true;
      return [product.name, product.description, productCategoryLabel(product.category)]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search));
    })
    .sort((first, second) => Number(second.isActive) - Number(first.isActive) || first.name.localeCompare(second.name));
}

export function createProduct(payload) {
  validateProduct(payload);
  const now = new Date().toISOString();
  const products = readProducts();
  const product = {
    id: id("product"),
    name: payload.name.trim(),
    category: payload.category,
    costPrice: Number(payload.costPrice),
    salePrice: Number(payload.salePrice),
    stockQty: Number(payload.stockQty),
    minStock: Number(payload.minStock),
    description: String(payload.description || "").trim(),
    isActive: payload.isActive !== false,
    createdAt: now,
    updatedAt: now
  };
  products.push(product);
  writeProducts(products);
  return publicProduct(product);
}

export function updateProduct(productId, payload) {
  validateProduct(payload);
  const products = readProducts();
  const product = products.find((item) => item.id === productId);
  if (!product) throw new Error("Produto não encontrado.");

  product.name = payload.name.trim();
  product.category = payload.category;
  product.costPrice = Number(payload.costPrice);
  product.salePrice = Number(payload.salePrice);
  product.stockQty = Number(payload.stockQty);
  product.minStock = Number(payload.minStock);
  product.description = String(payload.description || "").trim();
  product.isActive = payload.isActive !== false;
  product.updatedAt = new Date().toISOString();

  writeProducts(products);
  return publicProduct(product);
}

export function deleteProduct(productId) {
  const products = readProducts();
  writeProducts(products.filter((product) => product.id !== productId));
}

export function toggleProduct(productId) {
  const products = readProducts();
  const product = products.find((item) => item.id === productId);
  if (!product) throw new Error("Produto não encontrado.");
  product.isActive = product.isActive === false;
  product.updatedAt = new Date().toISOString();
  writeProducts(products);
  return publicProduct(product);
}

export function createProductSale(payload) {
  const quantity = Number(payload.quantity);
  if (!String(payload.productId || "").trim()) throw new Error("Produto é obrigatório.");
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Quantidade deve ser maior que zero.");
  if (!String(payload.date || "").trim()) throw new Error("Data é obrigatória.");

  const products = readProducts();
  const product = products.find((item) => item.id === payload.productId);
  if (!product) throw new Error("Produto não encontrado.");
  if (product.isActive === false) throw new Error("Produto inativo não pode ser vendido.");
  if (Number(product.stockQty) < quantity) throw new Error("Quantidade maior que o estoque disponível.");

  product.stockQty = Number(product.stockQty) - quantity;
  product.updatedAt = new Date().toISOString();
  writeProducts(products);

  const now = new Date().toISOString();
  const sales = readSales();
  const sale = {
    id: id("sale"),
    productId: product.id,
    productName: product.name,
    unitPrice: Number(product.salePrice),
    unitCost: Number(product.costPrice),
    quantity,
    total: Number(product.salePrice) * quantity,
    date: payload.date,
    clientId: payload.clientId || "",
    clientName: payload.clientName || "",
    notes: String(payload.notes || "").trim(),
    createdAt: now
  };

  sales.push(sale);
  writeSales(sales);
  return publicSale(sale);
}

export function listProductSales(filters = {}) {
  return readSales()
    .map(publicSale)
    .filter((sale) => !filters.startDate || sale.date >= filters.startDate)
    .filter((sale) => !filters.endDate || sale.date <= filters.endDate)
    .filter((sale) => !filters.productId || sale.productId === filters.productId)
    .filter((sale) => !filters.clientId || sale.clientId === filters.clientId)
    .filter((sale) => {
      const search = String(filters.search || "").trim().toLowerCase();
      if (!search) return true;
      return [sale.productName, sale.clientName, sale.notes]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search));
    })
    .sort((first, second) => `${second.date}${second.createdAt}`.localeCompare(`${first.date}${first.createdAt}`));
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
