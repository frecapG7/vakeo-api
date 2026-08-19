import express from "express";
import passport from "passport";
import { getTrip } from "../services/tripService.mjs";
import { verifyUser } from "../services/validationService.mjs";
import { search, getLink, createLink, updateLink, deleteLink } from "../services/linkService.mjs";
import { sanitizeLimit } from "../utils/pagination.mjs";

const app = express();

/**
 * GET /v2/trips/:tripId/links
 * List all links for a trip with pagination
 * @param {string} tripId - Trip ID
 * @query {string} search - Filter by text in title, description, or url
 * @query {string} cursor - Pagination cursor (link _id)
 * @query {number} limit - Max results per page (default: 10)
 * @returns {object} - Paginated list of links with next cursor
 */
app.get("/v2/trips/:tripId/links", async (req, res) => {
    const { tripId } = req.params;
    const { limit = 10 } = req.query;
    const sanitizedLimit = sanitizeLimit(limit);
    const links = await search(tripId, {
        ...req?.query,
        limit: sanitizedLimit
    });

    const nextCursor = links.length === sanitizedLimit ? links[links.length - 1]?._id : null;

    return res.status(200).json({
        nextCursor,
        totalResults: links.length,
        links
    });
});

/**
 * GET /v2/trips/:tripId/links/:linkId
 * Get a single link by ID
 * @param {string} tripId - Trip ID
 * @param {string} linkId - Link ID
 * @returns {object} - The requested link
 */
app.get("/v2/trips/:tripId/links/:linkId", async (req, res) => {
    const { tripId, linkId } = req.params;
    const link = await getLink(tripId, linkId);
    return res.status(200).json(link);
});

/**
 * POST /v2/trips/:tripId/links
 * Create a new link for a trip (auth required)
 * @param {string} tripId - Trip ID
 * @body {string} url - Link URL (required)
 * @body {string} title - Link title (required)
 * @body {string} icon - Link icon (optional)
 * @body {string} description - Link description (optional)
 * @returns {object} - The created link
 */
app.post("/v2/trips/:tripId/links", passport.authenticate('user-header', { session: false }), async (req, res) => {
    const trip = await getTrip(req.params.tripId);
    verifyUser(trip, req.user);

    const link = await createLink(trip, req.body);
    return res.status(201).json(link);
});

/**
 * PUT /v2/trips/:tripId/links/:linkId
 * Update a link (auth required)
 * @param {string} tripId - Trip ID
 * @param {string} linkId - Link ID
 * @body {string} url - New URL (optional)
 * @body {string} title - New title (optional)
 * @body {string} icon - New icon (optional)
 * @body {string} description - New description (optional)
 * @returns {object} - The updated link
 */
app.put("/v2/trips/:tripId/links/:linkId", passport.authenticate('user-header', { session: false }), async (req, res) => {
    const { tripId, linkId } = req.params;
    const trip = await getTrip(tripId);
    verifyUser(trip, req.user);

    const link = await getLink(tripId, linkId);
    const updatedLink = await updateLink(link, req.body);
    return res.status(200).json(updatedLink);
});

/**
 * DELETE /v2/trips/:tripId/links/:linkId
 * Delete a link (auth required)
 * @param {string} tripId - Trip ID
 * @param {string} linkId - Link ID
 * @returns {object} - Empty response
 */
app.delete("/v2/trips/:tripId/links/:linkId", passport.authenticate('user-header', { session: false }), async (req, res) => {
    const { tripId, linkId } = req.params;
    const trip = await getTrip(tripId);
    verifyUser(trip, req.user);

    await deleteLink(tripId, linkId);
    return res.status(204).json({});
});

export default app;
