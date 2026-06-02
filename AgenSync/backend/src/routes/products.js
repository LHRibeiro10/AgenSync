import { Router } from "express";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import {
  clientAccessWhere,
  hasWorkspacePermission,
  requireAnyWorkspacePermission,
  requireWorkspacePermission,
  workspaceWhere
} from "../utils/accessControl.js";
import { parseDateOnly, startOfDay } from "../utils/dates.js";
import { publicProduct, publicProductSale } from "../utils/formatters.js";
import { clearSalesOverviewCache } from "./sales.js";
import {
  optionalString,
  parsePagination,
  parseNonNegativeInteger,
  parsePositiveInteger,
  parsePositiveMoney,
  requiredString
} from "../utils/validation.js";

const router = Router();

const clientSelect = {
  id: true,
  name: true
};

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
  client: { select: clientSelect }
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

async function findProductOrFail(req, id) {
  const product = await prisma.product.findFirst({ where: workspaceWhere(req, { id }) });
  if (!product) throw new ApiError(404, "Produto não encontrado.");
  return product;
}

function productWhere(req, query) {
  const where = workspaceWhere(req);
  if (query.activeOnly === "true" || query.active === "true" || !hasWorkspacePermission(req, "canManageProducts")) {
    where.isActive = true;
  }
  if (query.category) where.category = String(query.category);
  if (query.stock === "out") where.stockQty = { lte: 0 };
  if (query.stock === "low") where.stockQty = { gt: 0, lte: prisma.product.fields.minStock };
  if (query.stock === "attention") where.stockQty = { lte: prisma.product.fields.minStock };

  if (query.search) {
    const search = String(query.search).trim();
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } }
    ];
  }
  return where;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    requireAnyWorkspacePermission(["canManageProducts", "canCreateSales"])(req, res, () => {});
    const pagination = parsePagination(req.query, {
      defaultPageSize: 120,
      maxPageSize: 300
    });

    const products = await prisma.product.findMany({
      where: productWhere(req, req.query),
      ...(pagination.enabled ? { skip: pagination.skip, take: pagination.take } : {}),
      select: productSelect,
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    });

    res.json({ products: products.map(publicProduct) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    requireWorkspacePermission("canManageProducts")(req, res, () => {});
    const product = await prisma.product.create({
      data: {
        workspaceId: req.workspaceId || null,
        userId: req.user.id,
        name: requiredString(req.body.name, "nome", 2),
        category: requiredString(req.body.category, "categoria"),
        costPrice: parsePositiveMoney(req.body.costPrice, "preço de custo"),
        salePrice: parsePositiveMoney(req.body.salePrice, "preço de venda"),
        stockQty: parseNonNegativeInteger(req.body.stockQty, "estoque"),
        minStock: parseNonNegativeInteger(req.body.minStock, "estoque mínimo"),
        description: optionalString(req.body.description),
        isActive: req.body.isActive !== false
      }
    });

    clearSalesOverviewCache();
    res.status(201).json({ product: publicProduct(product) });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    requireWorkspacePermission("canManageProducts")(req, res, () => {});
    await findProductOrFail(req, req.params.id);
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        name: requiredString(req.body.name, "nome", 2),
        category: requiredString(req.body.category, "categoria"),
        costPrice: parsePositiveMoney(req.body.costPrice, "preço de custo"),
        salePrice: parsePositiveMoney(req.body.salePrice, "preço de venda"),
        stockQty: parseNonNegativeInteger(req.body.stockQty, "estoque"),
        minStock: parseNonNegativeInteger(req.body.minStock, "estoque mínimo"),
        description: optionalString(req.body.description),
        isActive: req.body.isActive !== false
      }
    });

    clearSalesOverviewCache();
    res.json({ product: publicProduct(product) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    requireWorkspacePermission("canManageProducts")(req, res, () => {});
    await findProductOrFail(req, req.params.id);
    const sales = await prisma.productSale.count({ where: workspaceWhere(req, { productId: req.params.id }) });
    if (sales) throw new ApiError(409, "Produto com vendas registradas deve ser inativado.");
    await prisma.product.delete({ where: { id: req.params.id } });
    clearSalesOverviewCache();
    res.status(204).send();
  })
);

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
  "/sales/list",
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
  "/sales/list",
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
