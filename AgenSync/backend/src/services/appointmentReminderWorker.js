import { processDueAppointmentReminders } from "./appointmentReminderService.js";

function positiveIntEnv(name, fallback) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export function startAppointmentReminderWorker() {
  if (process.env.NODE_ENV === "test" || process.env.APPOINTMENT_REMINDER_WORKER_ENABLED === "0") {
    return () => {};
  }

  const intervalMs = Math.max(15000, positiveIntEnv("APPOINTMENT_REMINDER_WORKER_INTERVAL_MS", 60000));
  const limit = Math.min(Math.max(positiveIntEnv("APPOINTMENT_REMINDER_WORKER_LIMIT", 100), 1), 500);
  let running = false;

  async function tick() {
    if (running) return;
    running = true;

    try {
      const result = await processDueAppointmentReminders({ limit });
      if (process.env.NODE_ENV !== "production" && result.processed) {
        // eslint-disable-next-line no-console
        console.log("[APPOINTMENT_REMINDER_WORKER]", result);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[APPOINTMENT_REMINDER_WORKER_ERROR]", error?.message || error);
    } finally {
      running = false;
    }
  }

  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  setTimeout(tick, 5000).unref?.();

  return () => clearInterval(timer);
}
