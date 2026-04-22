import { Router } from "express";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { parseDateOnly, startOfDay } from "../utils/dates.js";
import { publicProductSale } from "../utils/formatters.js";
import { optionalString, parsePagination, parsePositiveInteger, requiredString } from "../utils/validation.js";

const router = Router();

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
  "/",
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query, {
      defaultPageSize: 120,
      maxPageSize: 300
    });

    const sales = await prisma.productSale.findMany({
      where: saleWhere(req.user.id, req.query),
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
    const productId = requiredString(req.body.productId, "produto");
    const quantity = parsePositiveInteger(req.body.quantity, "quantidade");
    const date = parseDateOnly(requiredString(req.body.date, "data"));
    const clientId = optionalString(req.body.clientId) || null;
    const notes = optionalString(req.body.notes);

    const sale = await prisma.$transaction(async (tx) => {
      const [product, client] = await Promise.all([
        tx.product.findFirst({ where: { id: productId, userId: req.user.id } }),
        clientId ? tx.client.findFirst({ where: { id: clientId, userId: req.user.id } }) : Promise.resolve(null)
      ]);

      if (!product) throw new ApiError(404, "Produto não encontrado.");
      if (!product.isActive) throw new ApiError(400, "Produto inativo não pode ser vendido.");
      if (product.stockQty < quantity) throw new ApiError(400, "Quantidade maior que o estoque disponível.");
      if (clientId && !client) throw new ApiError(400, "Cliente inválido para esta venda.");

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
        select: productSaleSelect
      });
    });

    res.status(201).json({ sale: publicProductSale(sale) });
  })
);

export default router;
