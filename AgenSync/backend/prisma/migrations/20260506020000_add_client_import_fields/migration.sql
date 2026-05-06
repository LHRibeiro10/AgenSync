ALTER TABLE "Client"
ADD COLUMN "cpf" TEXT,
ADD COLUMN "cnpj" TEXT,
ADD COLUMN "rg" TEXT,
ADD COLUMN "birthDate" TIMESTAMP(3),
ADD COLUMN "zipCode" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "addressNumber" TEXT,
ADD COLUMN "addressComplement" TEXT,
ADD COLUMN "district" TEXT,
ADD COLUMN "state" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "tags" TEXT,
ADD COLUMN "source" TEXT,
ADD COLUMN "externalId" TEXT;

CREATE INDEX "Client_userId_phone_idx" ON "Client"("userId", "phone");
CREATE INDEX "Client_userId_cpf_idx" ON "Client"("userId", "cpf");
CREATE INDEX "Client_userId_externalId_idx" ON "Client"("userId", "externalId");
