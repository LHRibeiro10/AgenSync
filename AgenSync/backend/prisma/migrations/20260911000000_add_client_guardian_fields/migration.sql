-- AlterTable
ALTER TABLE "Client" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "Client" ADD COLUMN "sexo" TEXT;
ALTER TABLE "Client" ADD COLUMN "contatoEmergenciaNome" TEXT;
ALTER TABLE "Client" ADD COLUMN "contatoEmergenciaTelefone" TEXT;
ALTER TABLE "Client" ADD COLUMN "contatoEmergenciaParentesco" TEXT;
ALTER TABLE "Client" ADD COLUMN "responsavelId" TEXT;
ALTER TABLE "Client" ADD COLUMN "responsavelParentesco" TEXT;
ALTER TABLE "Client" ADD COLUMN "responsavelNome" TEXT;
ALTER TABLE "Client" ADD COLUMN "responsavelTelefone" TEXT;

-- CreateIndex
CREATE INDEX "Client_responsavelId_idx" ON "Client"("responsavelId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
