import { Router } from "express";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import {
  clientAccessWhere,
  requireAnyWorkspacePermission,
  requireWorkspacePermission,
  workspaceWhere
} from "../utils/accessControl.js";
import { parseDateOnly, startOfDay } from "../utils/dates.js";
import { publicClient, publicProduct, publicProductSale, publicProfessional } from "../utils/formatters.js";
import { optionalString, parsePagination, parsePositiveInteger, requiredString } from "../utils/validation.js";

const router = Router();
const SALES_OVERVIEW_CACHE_TTL_MS = Math.max(5_000, Number(process.env.SALES_OVERVIEW_CACHE_TTL_MS || 10_000));
const SALES_OVERVIEW_CACHE_MAX_ITEMS = Math.max(50, Number(process.env.SALES_OVERVIEW_CACHE_MAX_ITEMS || 200));
const salesOverviewCache = new Map();

const productSaleSelect = {
  id: true,
  productId: true,
  clientId: true,
  productName: true,
  unitPrice: true,
  unitCost: true,
  quantity: true,
  total: true,
  date: true,
  notes: true,
  createdAt: true,
  client: {
    select: {
      id: true,
      name: true
    }
  }
};

const productSelect = {
  id: true,
  name: true,
  category: true,
  costPrice: true,
  salePrice: true,
  stockQty: true,
  minStock: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
};

function salesOverviewCacheKey(req) {
  return JSON.stringify({
    workspaceId: req.workspaceId || "",
    userId: req.user?.id || "",
    role: req.user?.workspaceRole || req.user?.workspaceMember?.role || "",
    professionalId: req.user?.professionalId || "",
    query: req.query || {}
  });
}

function getCachedSalesOverview(key) {
  const cached = salesOverviewCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    salesOverviewCache.delete(key);
    return null;
  }
  return cached.value;
}

function setSalesOverviewCache(key, value) {
  if (salesOverviewCache.size >= SALES_OVERVIEW_CACHE_MAX_ITEMS) {
    const oldestKey = salesOverviewCache.keys().next().value;
    if (oldestKey) salesOverviewCache.delete(oldestKey);
  }
  salesOverviewCache.set(key, {
    value,
    expiresAt: Date.now() + SALES_OVERVIEW_CACHE_TTL_MS
  });
}

export function clearSalesOverviewCache() {
  salesOverviewCache.clear();
}

function saleWhere(req, query) {
  const where = workspaceWhere(req);
  if (query.productId) where.productId = String(query.productId);
  if (query.clientId) where.clientId = String(query.clientId);
  if (query.startDate || query.endDate) {
    where.date = {};
    if (query.startDate) where.date.gte = startOfDay(parseDateOnly(query.startDate, "data inicial"));
    if (query.endDate) {
      const end = startOfDay(parseDateOnly(query.endDate, "data final"));
      end.setDate(end.getDate() + 1);
      where.date.lt = end;
    }
  }
  if (query.search) {
    const search = String(query.search).trim();
    where.OR = [
      { productName: { contains: search, mode: "insensitive" } },
      { notes: { contains: search, mode: "insensitive" } },
      { client: { name: { contains: search, mode: "insensitive" } } }
    ];
  }
  return where;
}

router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    requireAnyWorkspacePermission(["canCreateSales", "canViewSalesReports"])(req, res, () => {});
    const cacheKey = salesOverviewCacheKey(req);
    const cached = getCachedSalesOverview(cacheKey);
    if (cached) return res.json(cached);

    const pagination = parsePagination(req.query, {
      defaultPageSize: 120,
      maxPageSize: 300
    });

    const [clients, professionals, products, sales] = await Promise.all([
      prisma.client.findMany({
        where: clientAccessWhere(req, { isActive: true }),
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          cpf: true,
          cnpj: true,
          rg: true,
          birthDate: true,
          zipCode: true,
          address: true,
          addressNumber: true,
          addressComplement: true,
          district: true,
          state: true,
          city: true,
          tags: true,
          source: true,
          externalId: true,
          notes: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: [{ name: "asc" }],
        take: 300
      }),
      prisma.professional.findMany({
        where: workspaceWhere(req, { isActive: true }),
        orderBy: [{ name: "asc" }],
        take: 300
      }),
      prisma.product.findMany({
        where: workspaceWhere(req, { isActive: true }),
        select: productSelect,
        orderBy: [{ name: "asc" }],
        take: 300
      }),
      prisma.productSale.findMany({
        where: saleWhere(req, req.query),
        ...(pagination.enabled ? { skip: pagination.skip, take: pagination.take } : {}),
        select: productSaleSelect,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }]
      })
    ]);

    const payload = {
      clients: clients.map(publicClient),
      professionals: professionals.map(publicProfessional),
      products: products.map(publicProduct),
      sales: sales.map(publicProductSale)
    };
    setSalesOverviewCache(cacheKey, payload);
    res.json(payload);
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    requireWorkspacePermission("canViewSalesReports")(req, res, () => {});
    const pagination = parsePagination(req.query, {
      defaultPageSize: 120,
      maxPageSize: 300
    });

    const sales = await prisma.productSale.findMany({
      where: saleWhere(req, req.query),
      ...(pagination.enabled ? { skip: pagination.skip, take: pagination.take } : {}),
      select: productSaleSelect,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }]
    });

    res.json({ sales: sales.map(publicProductSale) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    requireWorkspacePermission("canCreateSales")(req, res, () => {});
    const productId = requiredString(req.body.productId, "produto");
    const quantity = parsePositiveInteger(req.body.quantity, "quantidade");
    const date = parseDateOnly(requiredString(req.body.date, "data"));
    const clientId = optionalString(req.body.clientId) || null;
    const notes = optionalString(req.body.notes);

    const sale = await prisma.$transaction(async (tx) => {
      const [product, client] = await Promise.all([
        tx.product.findFirst({ where: workspaceWhere(req, { id: productId }) }),
        clientId ? tx.client.findFirst({ where: clientAccessWhere(req, { id: clientId }) }) : Promise.resolve(null)
      ]);

      if (!product) throw new ApiError(404, "Produto não encontrado.");
      if (!product.isActive) throw new ApiError(400, "Produto inativo não pode ser vendido.");
      if (product.stockQty < quantity) throw new ApiError(400, "Quantidade maior que o estoque disponível.");
      if (clientId && !client) throw new ApiError(400, "Cliente inválido para esta venda.");

      const stockUpdate = await tx.product.updateMany({
        where: workspaceWhere(req, { id: product.id, stockQty: { gte: quantity } }),
        data: { stockQty: { decrement: quantity } }
      });
      if (stockUpdate.count !== 1) throw new ApiError(400, "Quantidade maior que o estoque disponivel.");

      return tx.productSale.create({
        data: {
          workspaceId: req.workspaceId || null,
          userId: req.user.id,
          productId: product.id,
          clientId,
          productName: product.name,
          unitPrice: product.salePrice,
          unitCost: product.costPrice,
          quantity,
          total: Number(product.salePrice) * quantity,
          date,
          notes
        },
        select: productSaleSelect
      });
    });

    clearSalesOverviewCache();
    res.status(201).json({ sale: publicProductSale(sale) });
  })
);

export default router;
