import express from "express";
import rateLimit from "express-rate-limit";
import { getPreview } from "../../services/linkPreviewService.mjs";

const app = express();

// The scraper is expensive and abusable (SSRF probing, traffic amplification):
// much tighter than the global 1000/15min limit.
const previewLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
});

/**
 * POST /link-preview — build a preview card for a URL.
 * No trip scope: open to any caller behind the API key, under a tight
 * per-IP limit. SSRF-guarded by the service (private ranges → 403),
 * malformed URLs → 422, bot-blocked sites (booking.com & co) → retry
 * ladder then domain fallback card.
 * @body {string} url - https URL to preview
 * @returns {object} - { success, data: { url, title, description, image, icon, fallback } }
 */
app.post("/link-preview", previewLimiter, async (req, res) => {
    const preview = await getPreview(req.body?.url);
    return res.status(200).json(preview);
});

export default app;