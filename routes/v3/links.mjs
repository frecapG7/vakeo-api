import express from "express";
import { getTrip } from "../../services/tripService.mjs";
import { search, getLink, createLink, updateLink, deleteLink } from "../../services/linkService.mjs";
import { resolveEncodedTripId } from "../../services/idEncoderService.mjs";
import { requireMembership, requireReadAccess } from "../../services/validationService.mjs";
import { auth, optionalAuth } from "./auth.mjs";
import { sanitizeLimit } from "../../utils/pagination.mjs";

const app = express();

/**
 * GET /trips/:tripId/links — list links for a trip.
 * Public trip: anyone. Private trip: member only.
 */
app.get("/trips/:tripId/links", optionalAuth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireReadAccess(trip, req.user);
    const { limit = 10 } = req.query;
    const sanitizedLimit = sanitizeLimit(limit);
    const links = await search(rawId, { ...req?.query, limit: sanitizedLimit });

    const nextCursor = links.length === sanitizedLimit ? links[links.length - 1]?._id : null;
    return res.status(200).json({ nextCursor, totalResults: links.length, links });
});

/**
 * GET /trips/:tripId/links/:linkId — get a single link.
 */
app.get("/trips/:tripId/links/:linkId", optionalAuth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireReadAccess(trip, req.user);
    const link = await getLink(rawId, req.params.linkId);
    return res.status(200).json(link);
});

/**
 * POST /trips/:tripId/links — create a link (member only).
 */
app.post("/trips/:tripId/links", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    const link = await createLink(trip, req.body);
    return res.status(201).json(link);
});

/**
 * PUT /trips/:tripId/links/:linkId — update a link (member only).
 */
app.put("/trips/:tripId/links/:linkId", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    const link = await getLink(rawId, req.params.linkId);
    const updatedLink = await updateLink(link, req.body);
    return res.status(200).json(updatedLink);
});

/**
 * DELETE /trips/:tripId/links/:linkId — delete a link (member only).
 */
app.delete("/trips/:tripId/links/:linkId", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    await deleteLink(rawId, req.params.linkId);
    return res.status(204).json({});
});

export default app;
