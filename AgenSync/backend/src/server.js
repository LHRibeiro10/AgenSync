import "dotenv/config";
import { app } from "./app.js";
import { prisma } from "./prisma.js";
import { startAppointmentReminderWorker } from "./services/appointmentReminderWorker.js";

const PORT = process.env.PORT || 8080;
const stopAppointmentReminderWorker = startAppointmentReminderWorker();

const server = app.listen(PORT, () => {
  console.log(`AgenSync API rodando na porta ${PORT}`);
});

async function shutdown() {
  stopAppointmentReminderWorker();
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
