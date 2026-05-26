import { Router } from "express";
import { asyncHandler } from "../middleware/error.js";
import {
  processDueAppointmentReminders,
  rescheduleFutureAppointmentRemindersForUser
} from "../services/appointmentReminderService.js";

const router = Router();

router.post(
  "/process-due",
  asyncHandler(async (req, res) => {
    await rescheduleFutureAppointmentRemindersForUser(req.user.id, req.workspaceId || "");
    const result = await processDueAppointmentReminders({
      limit: req.body?.limit || req.query?.limit || 50,
      userId: req.user.id,
      workspaceId: req.workspaceId || ""
    });
    res.json(result);
  })
);

export default router;
