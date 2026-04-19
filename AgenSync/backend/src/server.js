import "dotenv/config";
import { app } from "./app.js";
import { prisma } from "./prisma.js";

const port = Number(process.env.PORT || 3333);

const server = app.listen(port, () => {
  console.log(`AgenSync API rodando em http://localhost:${port}`);
});

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
