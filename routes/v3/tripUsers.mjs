import express from "express";
import { getTrip } from "../../services/tripService.mjs";
import TripUser from "../../models/tripUserModel.mjs";
import { addSeatsToTrip, getTripUserById, getTripUserByToken, rotateTripUserToken } from "../../services/tripUserService.mjs";
import { resolveEncodedTripId } from "../../services/idEncoderService.mjs";
import { requireMembership, requireReadAccess, requireSeatOwnership } from "../../services/validationService.mjs";
import { auth, optionalAuth } from "./auth.mjs";
import { ForbiddenError, NotFoundError } from "../../utils/errors.mjs";

const app = express();

/**
 * GET /trips/:tripId/users — list all seats for a trip with claimed status.
 * Public trip: anyone. Private trip: member only.
 * Each seat includes `claimed: true/false` (free or taken).
 */
app.get("/trips/:tripId/users", optionalAuth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireReadAccess(trip, req.user);
    const users = await TripUser.find({ _id: { $in: trip.users } }).select("+token");
    const seats = users.map((u) => ({
        _id: u._id,
        name: u.name,
        avatar: u.avatar,
        claimed: !!u.token,
    }));
    return res.status(200).json(seats);
});

/**
 * GET /trips/:tripId/users/:tripUserId — get a single trip user.
 */
app.get("/trips/:tripId/users/:tripUserId", optionalAuth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireReadAccess(trip, req.user);
    const user = await getTripUserById(req.params.tripUserId);
    if (!user || !trip.users.some(u => u.toString() === String(user._id)))
        throw new NotFoundError(`User ${req.params.tripUserId} not found in trip ${trip._id}`);

    return res.status(200).json(user);
});

/**
 * POST /trips/:tripId/users/bulk — add seats in bulk (member only).
 * Creates all seats or none: every entry is validated first, then the
 * creation runs in a single transaction so the 20-seat limit is enforced
 * atomically and a failure never leaves orphaned seats.
 * Seat updates go through PUT /trips/:tripId/users/:tripUserId.
 * @body {object[]} users - [{ name, avatar }]
 * @returns {object[]} - the created seats
 */
app.post("/trips/:tripId/users/bulk", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);

    const savedUsers = await addSeatsToTrip(rawId, req.body?.users);
    return res.status(201).json(savedUsers);
});

/**
 * PUT /trips/:tripId/users/:tripUserId — update a single trip user (member only).
 */
app.put("/trips/:tripId/users/:tripUserId", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);

    if (!trip.users.some(u => u.toString() === String(req.params.tripUserId)))
        throw new ForbiddenError(`Error accessing trip user: user ${req.params.tripUserId} is no part of the trip ${trip._id}`);

    const user = await getTripUserById(req.params.tripUserId);
    const { name, avatar, restrictions } = req.body;
    user.name = name;
    user.avatar = avatar;
    user.restrictions = restrictions;
    const savedUser = await user.save();
    return res.status(200).json(savedUser);
});

/**
 * POST /trips/:tripId/users/:tripUserId/rotate-token — rotate the caller's own token.
 * Seat owner only: a member cannot rotate another seat's token. A different
 * target would require a privileged role — none exists in v3.
 */
app.post("/trips/:tripId/users/:tripUserId/rotate-token", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);

    if (!trip.users.some(u => u.toString() === String(req.params.tripUserId)))
        throw new ForbiddenError(`User ${req.params.tripUserId} is not part of trip ${trip._id}`);

    requireSeatOwnership(req.user, req.params.tripUserId);

    const newToken = await rotateTripUserToken(req.params.tripUserId);
    return res.status(200).json({ token: newToken });
});

export default app;
