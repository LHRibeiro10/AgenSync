import { Router } from "express";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { parseDateOnly, startOfDay } from "../utils/dates.js";
import { publicProduct, publicProductSale } from "../utils/formatters.js";
import {
  optionalString,
  parseNonNegativeInteger,
  parsePositiveInteger,
  parsePositiveMoney,
  requiredString
} from "../utils/validation.js";

const router = Router();

async function findProductOrFail(userId, id) {
  const product = await prisma.product.findFirst({ where: { id, userId } });
  if (!product) throw new ApiError(404, "Produto nÃ£o encontrado.");
  return product;
}

function productWhere(userId, query) {
  const where = { userId };
  if (query.activeOnly === "true" || query.active === "true") where.isActive = true;
  if (query.category) where.category = String(query.category);
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
    let products = await prisma.product.findMany({
      where: productWhere(req.user.id, req.query),
      orderBy: [{ isActive: "desc" }, { name: "asc" }]
    });

    if (req.query.stock) {
      products = products.filter((product) => {
        if (req.query.stock === "out") return product.stockQty <= 0;
        if (req.query.stock === "low") return product.stockQty > 0 && product.stockQty <= product.minStock;
        if (req.query.stock === "attention") return product.stockQty <= product.minStock;
        return true;
      });
    }

    res.json({ products: products.map(publicProduct) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const product = await prisma.product.create({
      data: {
        userId: req.user.id,
        name: requiredString(req.body.name, "nome", 2),
        category: requiredString(req.body.category, "categoria"),
        costPrice: parsePositiveMoney(req.body.costPrice, "preÃ§o de custo"),
        salePrice: parsePositiveMoney(req.body.salePrice, "preÃ§o de venda"),
        stockQty: parseNonNegativeInteger(req.body.stockQty, "estoque"),
        minStock: parseNonNegativeInteger(req.body.minStock, "estoque mÃ­nimo"),
        description: optionalString(req.body.description),
        isActive: req.body.isActive !== false
      }
    });

    res.status(201).json({ product: publicProduct(product) });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    await findProductOrFail(req.user.id, req.params.id);
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        name: requiredString(req.body.name, "nome", 2),
        category: requiredString(req.body.category, "categoria"),
        costPrice: parsePositiveMoney(req.body.costPrice, "preÃ§o de custo"),
        salePrice: parsePositiveMoney(req.body.salePrice, "preÃ§o de venda"),
        stockQty: parseNonNegativeInteger(req.body.stockQty, "estoque"),
        minStock: parseNonNegativeInteger(req.body.minStock, "estoque mÃ­nimo"),
        description: optionalString(req.body.description),
        isActive: req.body.isActive !== false
      }
    });

    res.json({ product: publicProduct(product) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await findProductOrFail(req.user.id, req.params.id);
    const sales = await prisma.productSale.count({ where: { userId: req.user.id, productId: req.params.id } });
    if (sales) throw new ApiError(409, "Produto com vendas registradas deve ser inativado.");
    await prisma.product.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

function saleWhere(userId, query) {
  const where = { userId };
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
    const sales = await prisma.productSale.findMany({
      where: saleWhere(req.user.id, req.query),
      include: { client: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }]
    });

    res.json({ sales: sales.map(publicProductSale) });
  })
);

router.post(
  "/sales/list",
  asyncHandler(async (req, res) => {
    const productId = requiredString(req.body.productId, "produto");
    const quantity = parsePositiveInteger(req.body.quantity, "quantidade");
    const date = parseDateOnly(requiredString(req.body.date, "data"));
    const clientId = optionalString(req.body.clientId) || null;
    const notes = optionalString(req.body.notes);

    const sale = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, userId: req.user.id } });
      if (!product) throw new ApiError(404, "Produto nÃ£o encontrado.");
      if (!product.isActive) throw new ApiError(400, "Produto inativo nÃ£o pode ser vendido.");
      if (product.stockQty < quantity) throw new ApiError(400, "Quantidade maior que o estoque disponÃ­vel.");

      if (clientId) {
        const client = await tx.client.findFirst({ where: { id: clientId, userId: req.user.id } });
        if (!client) throw new ApiError(400, "Cliente invÃ¡lido para esta venda.");
      }

      await tx.product.update({
        where: { id: product.id },
        data: { stockQty: product.stockQty - quantity }
      });

      return tx.productSale.create({
        data: {
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
        include: { client: true }
      });
    });

    res.status(201).json({ sale: publicProductSale(sale) });
  })
);

export default router;
