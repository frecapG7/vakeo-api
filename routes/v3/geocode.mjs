import express from "express";
import rateLimit from "express-rate-limit";
import { geocode } from "../../services/geocoding/index.mjs";

const app = express();

// Forward geocoding bills by the request and is easy to hammer blindly:
// much tighter than the global 1000/15min limit. The service-level TTL
// cache absorbs repeats, this limiter absorbs abuse.
const geocodeLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
});

/**
 * POST /geocode — resolve a free-form address to coordinates.
 * No trip scope: open to any caller behind the API key, under a tight
 * per-IP limit. Validation, provider selection and caching live in the
 * service; business errors surface as 422 via the error middleware.
 * @body {string} address - free-form address to geocode
 * @returns {object} - { success, data: [{ coordinates, displayName, provider }] }
 *   Up to 5 candidates ranked by the provider, coordinates in GeoJSON order
 *   ([longitude, latitude]); an empty data array means no candidate was found.
 */
app.post("/geocode", geocodeLimiter, async (req, res) => {
    const result = await geocode(req.body?.address);
    return res.status(200).json({ success: true, data: result });
});

export default app;
