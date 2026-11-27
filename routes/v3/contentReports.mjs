import express from "express";
import rateLimit from "express-rate-limit";
import { reportContent, reportContentAnonymously } from "../../services/contentReportService.mjs";
import { loadTripContext } from "../../services/tripContextService.mjs";
import { requireMembership } from "../../services/validationService.mjs";
import { auth } from "./auth.mjs";

const app = express();

// The public surface takes unauthenticated reports, so the limit is the only
// brake on a flood — tighter than the geocode/link-preview limits. The
// authenticated channel stays deduped per seat by the report index.
const reportLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: "draft-7",
    legacyHeaders: false,
});

/**
 * POST /trips/:tripId/reports — report one item of a trip (member only).
 * @body {string} subjectType - one of CONTENT_REPORT_SUBJECTS (contentReportService)
 * @body {string} subjectId - id of the reported item
 * @body {string} reason - one of CONTENT_REPORT_REASONS
 * @body {string} [comment] - optional free text, ≤ 500 chars
 * @returns {object} - 201 { report, alreadyReported: false } on a fresh report,
 *   200 { report, alreadyReported: true } when this member already reported the
 *   item. Unknown item (or wrong trip) → 404, own content → 403, bad payload → 422.
 */
app.post("/trips/:tripId/reports", auth, async (req, res) => {
    const { rawId } = await loadTripContext(req, requireMembership);
    const { subjectType, subjectId, reason, comment } = req.body ?? {};
    const { report, alreadyReported } = await reportContent(rawId, req.user._id, {
        subjectType,
        subjectId,
        reason,
        comment
    });
    return res.status(alreadyReported ? 200 : 201).json({ report, alreadyReported });
});

/**
 * POST /reports — report one item without a seat (DSA art. 16).
 * @body {string} subjectType - one of CONTENT_REPORT_SUBJECTS
 * @body {string} subjectId - id of the reported item
 * @body {string} reason - one of CONTENT_REPORT_REASONS
 * @body {string} [comment] - optional free text, ≤ 500 chars
 * @returns {object} - 202 { received: true }, also for an unknown or unscopable
 *   subject: the endpoint must not be an existence oracle. Invalid payloads → 422.
 */
app.post("/reports", reportLimiter, async (req, res) => {
    const { subjectType, subjectId, reason, comment } = req.body ?? {};
    await reportContentAnonymously({ subjectType, subjectId, reason, comment });
    return res.status(202).json({ received: true });
});

export default app;
