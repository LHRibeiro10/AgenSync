import { Router } from "express";
import { asyncHandler } from "../middleware/error.js";
import { processDueAppointmentReminders } from "../services/appointmentReminderService.js";

const router = Router();

router.post(
  "/process-due",
  asyncHandler(async (req, res) => {
    const result = await processDueAppointmentReminders({ limit: req.body?.limit || req.query?.limit || 50 });
    res.json(result);
  })
);

export default router;
