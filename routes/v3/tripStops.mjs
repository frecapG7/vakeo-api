import express from "express";
import {
    getTripStop,
    createTripStop,
    deleteTripStop,
    updateTripStop,
    getTripStops,
} from "../../services/tripStopService.mjs";
import { getTrip } from "../../services/tripService.mjs";
import { resolveEncodedTripId } from "../../services/idEncoderService.mjs";
import { requireMembership, requireReadAccess } from "../../services/validationService.mjs";
import { auth, optionalAuth } from "./auth.mjs";

const app = express();

/**
 * GET /:tripId/stops — list all stops for a trip.
 * Public trip: anyone. Private trip: member only.
 */
app.get("/trips/:tripId/stops", optionalAuth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireReadAccess(trip, req.user);
    const stops = await getTripStops(rawId);
    return res.status(200).json(stops);
});

/**
 * GET /:tripId/stops/:stopId — get a specific stop.
 */
app.get("/trips/:tripId/stops/:stopId", optionalAuth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireReadAccess(trip, req.user);
    const stop = await getTripStop(rawId, req.params.stopId);
    return res.status(200).json(stop);
});

/**
 * POST /:tripId/stops — create a new stop (member only).
 */
app.post("/trips/:tripId/stops", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    const stop = await createTripStop(rawId, req.body, req.user);
    return res.status(201).json(stop);
});

/**
 * PUT /:tripId/stops/:stopId — update a stop (member only).
 */
app.put("/trips/:tripId/stops/:stopId", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    const stop = await updateTripStop(rawId, req.params.stopId, req.body, req.user);
    return res.status(200).json(stop);
});

/**
 * DELETE /:tripId/stops/:stopId — delete a stop (member only).
 */
app.delete("/trips/:tripId/stops/:stopId", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    await deleteTripStop(rawId, req.params.stopId, req.user);
    return res.status(204).send();
});

export default app;
