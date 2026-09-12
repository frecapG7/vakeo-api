import express from "express";
import { createPoll, deletePoll, getPoll, searchPolls, unvotePoll, updatePoll, votePoll } from "../../services/pollsService.mjs";
import { getTrip } from "../../services/tripService.mjs";
import { resolveEncodedTripId } from "../../services/idEncoderService.mjs";
import { requireMembership, requireReadAccess } from "../../services/validationService.mjs";
import { auth, optionalAuth } from "./auth.mjs";

const app = express();

/**
 * GET /:tripId/polls — list polls for a trip.
 * Public trip: anyone. Private trip: member only.
 */
app.get("/trips/:tripId/polls", optionalAuth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireReadAccess(trip, req.user);
    const polls = await searchPolls(rawId, req.query);

    const prevCursor = polls.length > 0 ? polls[0]._id : null;
    const nextCursor = polls.length > 0 ? polls[polls.length - 1]._id : null;

    return res.status(200).json({ nextCursor, prevCursor, totalResults: polls.length, polls });
});

/**
 * GET /trips/:tripId/polls/:pollId — get a single poll.
 */
app.get("/trips/:tripId/polls/:pollId", optionalAuth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireReadAccess(trip, req.user);
    const poll = await getPoll(rawId, req.params.pollId);
    return res.status(200).json(poll);
});

/**
 * POST /trips/:tripId/polls — create a poll (member only).
 */
app.post("/trips/:tripId/polls", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    const newPoll = await createPoll(trip, req.body, req.user);
    return res.status(201).json(newPoll);
});

/**
 * PUT /trips/:tripId/polls/:pollId — update a poll (member only).
 */
app.put("/trips/:tripId/polls/:pollId", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    const newPoll = await updatePoll(trip, req.params.pollId, req.user, req.body);
    return res.status(200).json(newPoll);
});

/**
 * PATCH /trips/:tripId/polls/:pollId/vote — vote on a poll (member only).
 */
app.patch("/trips/:tripId/polls/:pollId/vote", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    const newPoll = await votePoll(trip, req.params.pollId, { ...req.body, user: req.user });
    return res.status(200).json(newPoll);
});

/**
 * DELETE /trips/:tripId/polls/:pollId/vote/:optionsId — remove a vote (member only).
 */
app.delete("/trips/:tripId/polls/:pollId/vote/:optionsId", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    const newPoll = await unvotePoll(trip, req.params.pollId, req.params.optionsId, req.user._id);
    return res.status(200).json(newPoll);
});

/**
 * DELETE /trips/:tripId/polls/:pollId — close/delete a poll (member only).
 */
app.delete("/trips/:tripId/polls/:pollId", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    const poll = await deletePoll(rawId, req.params.pollId, req.user._id);
    return res.status(200).json(poll);
});

export default app;
