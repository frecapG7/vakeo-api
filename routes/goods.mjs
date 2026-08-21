
import express from "express";
import { getTrip } from "../services/tripService.mjs";
import { checkGood, checkMultipleGoods, createGood, getGood, search, updateGood } from "../services/goodsService.mjs";
import { verifyUser } from "../services/validationService.mjs";
import passport from "passport";
import { sanitizeLimit, buildCursor, readCursor } from "../utils/pagination.mjs";

const app = express();

/**
 * GET /trips/:tripId/goods
 * List all goods for a trip with pagination
 * @param {string} tripId - Trip ID
 * @query {string} search - Filter by good name
 * @query {string} cursor - Pagination cursor
 * @query {number} limit - Max results per page (default: 10)
 * @query {string} event - Filter by event ID
 * @query {boolean} unchecked - Filter by unchecked goods only
 * @returns {object} - Paginated list of goods with next cursors
 */
app.get("/trips/:tripId/goods", async (req, res) => {
    const { tripId } = req.params;
    const { limit } = req?.query;
    const sanitizedLimit = sanitizeLimit(limit);
    const goods = await search(tripId, {
        ...req?.query,
        limit: sanitizedLimit
    });

    const nextCursor = goods.length === sanitizedLimit ? buildCursor({
        _id: goods[goods.length - 1]?._id.toString(),
        checked: goods[goods.length - 1]?.checked,
        name: goods[goods.length - 1]?.name
    }) : null;

    return res.status(200).json({
        nextCursor,
        totalResults: goods.length,
        goods
    });
});

/**
 * GET /trips/:tripId/goods/:goodId
 * Get a single good by ID
 * @param {string} tripId - Trip ID
 * @param {string} goodId - Good ID
 * @returns {object} - The requested good
 */
app.get("/trips/:tripId/goods/:goodId", async (req, res) => {
    const { tripId, goodId } = req.params;
    const good = await getGood(tripId, goodId);
    return res.status(200).json(good);

});

//@deprecated
app.post("/trips/:tripId/goods", async (req, res) => {
    const trip = await getTrip(req.params.tripId);
    const good = await createGood(trip, req.body);
    return res.status(201).json(good);
});

/**
 * POST /v2/trips/:tripId/goods
 * Create a new good for a trip (auth required)
 * @param {string} tripId - Trip ID
 * @body {string} name - Good name
 * @body {number} quantityNumber - Quantity number
 * @body {string} unit - Unit of measurement
 * @body {string} event - Event ID
 * @returns {object} - The created good
 */
app.post("/v2/trips/:tripId/goods", passport.authenticate('user-header', { session: false }), async (req, res) => {
    const trip = await getTrip(req.params.tripId);
    verifyUser(trip, req.user);
    const good = await createGood(trip, {
        ...req.body,
        createdBy: req.user
    });
    return res.status(201).json(good);

});


//@deprecated
app.delete("/trips/:tripId/goods/:goodId", async (req, res) => {
    const { tripId, goodId } = req.params;
    const good = await getGood(tripId, goodId);
    await good.deleteOne();
    return res.status(204).json({});
});

/**
 * DELETE /v2/trips/:tripId/goods/:goodId
 * Delete a good (auth required)
 * @param {string} tripId - Trip ID
 * @param {string} goodId - Good ID
 * @returns {object} - Empty response
 */
app.delete("/v2/trips/:tripId/goods/:goodId", passport.authenticate('user-header', { session: false }), async (req, res) => {
    const { tripId, goodId } = req.params;
    const trip = await getTrip(tripId);
    verifyUser(trip, req.user);

    const good = await getGood(tripId, goodId);
    await good.deleteOne();
    return res.status(204).json({});
});

/**
 * PUT /v2/trips/:tripId/goods/checked
 * Mark multiple goods as checked (auth required)
 * @param {string} tripId - Trip ID
 * @query {string} event - Filter by event ID
 * @query {string} createdBy - Filter by creator ID
 * @returns {object} - Update result with matched/modified counts
 */
app.put("/v2/trips/:tripId/goods/checked", passport.authenticate('user-header', { session: false }), async (req, res) => {
    const { tripId } = req.params;
    const trip = await getTrip(tripId);
    verifyUser(trip, req.user);

    const { event, createdBy } = req.query;
    const result = await checkMultipleGoods(tripId, { event, createdBy });
    return res.status(200).json(result);
});

//@deprecated
app.put("/trips/:tripId/goods/:goodId/checked", async (req, res) => {
    const { tripId, goodId } = req.params;

    const good = await getGood(tripId, goodId);

    const newGood = await checkGood(good);
    return res.status(200).json(newGood);
});

/**
 * PUT /v2/trips/:tripId/goods/:goodId/checked
 * Toggle checked status of a good
 * @param {string} tripId - Trip ID
 * @param {string} goodId - Good ID
 * @returns {object} - The updated good
 */
app.put("/v2/trips/:tripId/goods/:goodId/checked", passport.authenticate('user-header', { session: false }), async (req, res) => {
    const { tripId, goodId } = req.params;
    const trip = await getTrip(tripId);
    verifyUser(trip, req.user);

    const good = await getGood(tripId, goodId);

    const newGood = await checkGood(good);
    return res.status(200).json(newGood);
});

//@deprecated
app.put("/trips/:tripId/goods/:goodId", async (req, res) => {
    const { tripId, goodId } = req.params;
    const good = await getGood(tripId, goodId);
    const newGood = await updateGood(good, req.body);
    return res.status(200).json(newGood);
});

/**
 * PUT /v2/trips/:tripId/goods/:goodId
 * Update a good (auth required)
 * @param {string} tripId - Trip ID
 * @param {string} goodId - Good ID
 * @body {string} name - New good name
 * @body {number} quantityNumber - New quantity number
 * @body {string} unit - New unit of measurement
 * @returns {object} - The updated good
 */
app.put("/v2/trips/:tripId/goods/:goodId", passport.authenticate('user-header', { session: false }), async (req, res) => {
    const { tripId, goodId } = req.params;
    const trip = await getTrip(tripId);
    verifyUser(trip, req.user);

    const good = await getGood(tripId, goodId);
    const newGood = await updateGood(good, req.body);
    return res.status(200).json(newGood);
});

/****************************************************************
 *                      PROTECTED METHODS
 * **************************************************************
 */

export default app;