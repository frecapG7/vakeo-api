import express from "express";
import { getTrip } from "../../services/tripService.mjs";
import { createEvent, getEvent, search, updateEvent } from "../../services/eventsService.mjs";
import { resolveEncodedTripId } from "../../services/idEncoderService.mjs";
import { requireMembership, requireReadAccess } from "../../services/validationService.mjs";
import { auth, optionalAuth } from "./auth.mjs";
import { buildCursor, sanitizeLimit } from "../../utils/pagination.mjs";
import { ForbiddenError, NotImplementedError } from "../../utils/errors.mjs";

const app = express();

/**
 * GET /trips/:tripId/events — list events for a trip.
 * Public trip: anyone. Private trip: member only.
 */
app.get("/trips/:tripId/events", optionalAuth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireReadAccess(trip, req.user);
    const { limit = 10 } = req?.query;
    const sanitizedLimit = sanitizeLimit(limit);
    const events = await search(rawId, { ...req?.query, limit: sanitizedLimit });

    const nextCursor = events?.length === sanitizedLimit ? buildCursor({
        _id: events[events.length - 1]?._id,
        startDate: events[events.length - 1]?.startDate
    }) : null;

    return res.status(200).json({ nextCursor, totalResults: events?.length, events });
});

/**
 * GET /trips/:tripId/events/:eventId — get a single event.
 */
app.get("/trips/:tripId/events/:eventId", optionalAuth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireReadAccess(trip, req.user);
    const event = await getEvent(rawId, req.params.eventId);
    return res.status(200).json(event);
});

/**
 * POST /trips/:tripId/events — create an event (member only).
 */
app.post("/trips/:tripId/events", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    const event = await createEvent(trip, req.body);
    return res.status(201).json(event);
});

/**
 * PUT /trips/:tripId/events/:eventId — update an event (member only).
 */
app.put("/trips/:tripId/events/:eventId", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    const event = await getEvent(rawId, req.params.eventId);
    const updatedEvent = await updateEvent(event, req.body);
    return res.status(200).json(updatedEvent);
});

/**
 * DELETE /trips/:tripId/events/:eventId — delete an event (member only).
 * Only an owner of the event may delete it.
 */
app.delete("/trips/:tripId/events/:eventId", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    const event = await getEvent(rawId, req.params.eventId);

    if (event?.owners?.filter(u => u._id.equals(req.user._id)).length === 0)
        throw new ForbiddenError("Only an event owner can delete it");
    // Not Implemented
    throw new NotImplementedError("This feature is not yet implemented")
});

export default app;
