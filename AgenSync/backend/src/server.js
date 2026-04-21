import "dotenv/config";
import { app } from "./app.js";
import { prisma } from "./prisma.js";

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  console.log(`AgenSync API rodando na porta ${PORT}`);
});

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
