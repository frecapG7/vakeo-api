import express from "express";
import { getTrip } from "../../services/tripService.mjs";
import TripUser from "../../models/tripUserModel.mjs";
import { createTripUser, getTripUserById, getTripUserByToken, rotateTripUserToken } from "../../services/tripUserService.mjs";
import { resolveEncodedTripId } from "../../services/idEncoderService.mjs";
import { requireMembership, requireReadAccess } from "../../services/validationService.mjs";
import { auth, optionalAuth } from "./auth.mjs";
import { ForbiddenError, InvalidError } from "../../utils/errors.mjs";

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
    return res.status(200).json(user);
});

/**
 * POST /trips/:tripId/users — add a user to a public trip (member only).
 * Private trips use the join capability (M4).
 */
app.post("/trips/:tripId/users", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    if (trip.isPrivate)
        throw new ForbiddenError("Cannot add user on private trip — use join capability");
    if (trip.users.length >= 20)
        throw new InvalidError("Cannot add user: trip already has the maximum number of users");

    const newUser = await createTripUser(req.body);
    trip.users.push(newUser._id);
    const savedTrip = await trip.save();
    await savedTrip.populate("users");
    return res.status(200).json(savedTrip);
});

/**
 * PUT /trips/:tripId/users — bulk update users (member only).
 */
app.put("/trips/:tripId/users", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);

    const newUserCount = req.body.users.filter(u => !u._id).length;
    if (trip.users.length + newUserCount > 20)
        throw new InvalidError("Cannot add user: trip already has the maximum number of users");

    const users = req.body.users.map(async (user) => {
        let dbUser;
        if (user._id) {
            if (!trip.users.some(u => u.toString() === String(user._id)))
                throw new ForbiddenError(`Cannot update list of users: user ${user._id} is no part of the trip ${trip._id}`);
            dbUser = await getTripUserById(user._id);
        } else {
            dbUser = await createTripUser(user);
            trip.users.push(dbUser._id);
        }
        dbUser.name = user.name ?? dbUser.name;
        dbUser.avatar = user.avatar ?? dbUser.avatar;
        return await dbUser.save();
    });

    const savedUsers = await Promise.all(users);
    await trip.save();
    return res.status(200).json(savedUsers);
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
 * POST /trips/:tripId/users/:tripUserId/rotate-token — rotate a user's token (member only).
 */
app.post("/trips/:tripId/users/:tripUserId/rotate-token", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);

    if (!trip.users.some(u => u.toString() === String(req.params.tripUserId)))
        throw new ForbiddenError(`User ${req.params.tripUserId} is not part of trip ${trip._id}`);

    const newToken = await rotateTripUserToken(req.params.tripUserId);
    return res.status(200).json({ token: newToken });
});

export default app;
