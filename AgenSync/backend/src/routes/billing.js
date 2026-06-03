import { Router } from "express";
import {
  createBillingCheckoutSession,
  createBillingPortalSession,
  getBillingStatus,
  normalizeBillingProvider,
  processBillingWebhook,
  verifyBillingWebhook
} from "../services/billingService.js";
import { asyncHandler } from "../middleware/error.js";
import { requireWorkspaceOwner } from "../utils/accessControl.js";

const router = Router();
export const billingWebhookRouter = Router();

router.get(
  "/status",
  asyncHandler(async (req, res) => {
    requireWorkspaceOwner(req);
    const status = await getBillingStatus(req.workspaceId);
    res.json(status);
  })
);

router.post(
  "/checkout-session",
  asyncHandler(async (req, res) => {
    requireWorkspaceOwner(req);
    const checkout = await createBillingCheckoutSession(req.workspaceId, {
      plan: req.body?.plan || req.body?.planSlug,
      planSlug: req.body?.planSlug || req.body?.plan,
      successUrl: req.body?.successUrl,
      cancelUrl: req.body?.cancelUrl
    });
    res.status(201).json({ checkout });
  })
);

router.post(
  "/portal-session",
  asyncHandler(async (req, res) => {
    requireWorkspaceOwner(req);
    const portal = await createBillingPortalSession(req.workspaceId);
    res.status(201).json({ portal });
  })
);

billingWebhookRouter.post(
  "/:provider",
  asyncHandler(async (req, res) => {
    const provider = normalizeBillingProvider(req.params.provider);
    const event = verifyBillingWebhook(provider, req);
    const result = await processBillingWebhook(provider, event);

    if (result.error) {
      throw result.error;
    }

    res.json({
      received: true,
      duplicate: Boolean(result.duplicate),
      event: result.event,
      result: result.result || null
    });
  })
);

export default router;
