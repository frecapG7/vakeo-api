import express from "express";
import rateLimit from "express-rate-limit";
import { reportMessageAnonymously } from "../../services/messageReportService.mjs";

const app = express();

// This surface takes unauthenticated reports, so the limit is the only brake on
// a flood — tighter than the geocode/link-preview limits. The authenticated
// channel (POST /trips/:tripId/messages/:messageId/reports) stays deduped per
// seat in messages.mjs.
const reportLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: "draft-7",
    legacyHeaders: false,
});

/**
 * POST /reports — report a message without a seat (DSA art. 16).
 * @body {string} messageId - raw message id (v3 keeps trip ids encoded only)
 * @body {string} reason - one of MESSAGE_REPORT_REASONS (messageReportService)
 * @body {string} [comment] - optional free text, ≤ 500 chars
 * @returns {object} - 202 { received: true }, also for an unknown message id:
 *   the endpoint must not be an existence oracle. Invalid payloads → 422.
 */
app.post("/reports", reportLimiter, async (req, res) => {
    await reportMessageAnonymously(req.body?.messageId, req.body);
    return res.status(202).json({ received: true });
});

export default app;
