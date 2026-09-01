ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "brand" TEXT,
  ADD COLUMN IF NOT EXISTS "supplierName" TEXT,
  ADD COLUMN IF NOT EXISTS "supplierContact" TEXT,
  ADD COLUMN IF NOT EXISTS "sku" TEXT,
  ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT 'unidade',
  ADD COLUMN IF NOT EXISTS "expirationDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "usageType" TEXT NOT NULL DEFAULT 'revenda';

CREATE TABLE IF NOT EXISTS "ProductVariant" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sku" TEXT,
  "costPrice" DECIMAL(10, 2) NOT NULL,
  "salePrice" DECIMAL(10, 2) NOT NULL,
  "stockQty" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductStockMovement" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "type" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "supplierName" TEXT,
  "clientId" TEXT,
  "professionalId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductStockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX IF NOT EXISTS "ProductStockMovement_productId_createdAt_idx" ON "ProductStockMovement"("productId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductVariant_productId_fkey'
  ) THEN
    ALTER TABLE "ProductVariant"
      ADD CONSTRAINT "ProductVariant_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductStockMovement_productId_fkey'
  ) THEN
    ALTER TABLE "ProductStockMovement"
      ADD CONSTRAINT "ProductStockMovement_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
