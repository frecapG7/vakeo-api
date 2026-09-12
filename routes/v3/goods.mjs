import express from "express";
import { getTrip } from "../../services/tripService.mjs";
import { checkGood, checkMultipleGoods, createGood, getGood, search, updateGood } from "../../services/goodsService.mjs";
import { resolveEncodedTripId } from "../../services/idEncoderService.mjs";
import { requireMembership, requireReadAccess } from "../../services/validationService.mjs";
import { auth, optionalAuth } from "./auth.mjs";
import { sanitizeLimit, buildCursor, readCursor } from "../../utils/pagination.mjs";

const app = express();

/**
 * GET /trips/:tripId/goods — list goods for a trip.
 * Public trip: anyone. Private trip: member only.
 */
app.get("/trips/:tripId/goods", optionalAuth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireReadAccess(trip, req.user);
    const { limit } = req?.query;
    const sanitizedLimit = sanitizeLimit(limit);
    const goods = await search(rawId, { ...req?.query, limit: sanitizedLimit });

    const nextCursor = goods.length === sanitizedLimit ? buildCursor({
        _id: goods[goods.length - 1]?._id.toString(),
        checked: goods[goods.length - 1]?.checked,
        name: goods[goods.length - 1]?.name
    }) : null;

    return res.status(200).json({ nextCursor, totalResults: goods.length, goods });
});

/**
 * GET /trips/:tripId/goods/:goodId — get a single good.
 */
app.get("/trips/:tripId/goods/:goodId", optionalAuth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireReadAccess(trip, req.user);
    const good = await getGood(rawId, req.params.goodId);
    return res.status(200).json(good);
});

/**
 * POST /trips/:tripId/goods — create a good (member only).
 */
app.post("/trips/:tripId/goods", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    const good = await createGood(trip, { ...req.body, createdBy: req.user });
    return res.status(201).json(good);
});

/**
 * DELETE /trips/:tripId/goods/:goodId — delete a good (member only).
 */
app.delete("/trips/:tripId/goods/:goodId", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    const good = await getGood(rawId, req.params.goodId);
    await good.deleteOne();
    return res.status(204).json({});
});

/**
 * PUT /trips/:tripId/goods/checked — mark multiple goods as checked (member only).
 */
app.put("/trips/:tripId/goods/checked", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    const { event, createdBy } = req.query;
    const result = await checkMultipleGoods(rawId, { event, createdBy });
    return res.status(200).json(result);
});

/**
 * PUT /trips/:tripId/goods/:goodId/checked — toggle checked status (member only).
 */
app.put("/trips/:tripId/goods/:goodId/checked", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    const good = await getGood(rawId, req.params.goodId);
    const newGood = await checkGood(good);
    return res.status(200).json(newGood);
});

/**
 * PUT /trips/:tripId/goods/:goodId — update a good (member only).
 */
app.put("/trips/:tripId/goods/:goodId", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    const good = await getGood(rawId, req.params.goodId);
    const newGood = await updateGood(good, req.body);
    return res.status(200).json(newGood);
});

export default app;
