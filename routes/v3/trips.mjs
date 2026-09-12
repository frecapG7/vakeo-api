import express from "express";
import {
    getTrip,
    createTrip,
    deleteTrip,
    updateTrip,
    dashboard,
    search,
} from "../../services/tripService.mjs";
import { createTripUsers, createTripUser, claimSeat, releaseSeat } from "../../services/tripUserService.mjs";
import { generateJoinToken, verifyJoinToken } from "../../services/joinTokenService.mjs";
import { encodeId, resolveEncodedTripId } from "../../services/idEncoderService.mjs";
import { requireMembership, requireReadAccess } from "../../services/validationService.mjs";
import { auth, optionalAuth } from "./auth.mjs";
import { InvalidError, ForbiddenError } from "../../utils/errors.mjs";

const app = express();

/**
 * GET / — search trips (filtered to trips the caller can read).
 * Public trips are visible to all; private trips only to members.
 * @query {string} ids - comma-separated encoded trip ids
 * @query {string} search - text filter on trip name
 * @returns {object[]} - trips visible to the caller
 */
app.get("/", optionalAuth, async (req, res) => {
    const { ids, ...rest } = req.query;
    if (!ids)
        return res.status(200).json([]);

    const rawIds = ids.split(",").map((e) => resolveEncodedTripId(e));
    const trips = await search({ ids: rawIds.join(","), ...rest });

    const visible = trips.filter((t) => {
        if (!t.isPrivate) return true;
        if (!req.user) return false;
        return t.users.some((u) => {
            const uid = u?._id?.toString() || u?.toString();
            return uid === String(req.user._id);
        });
    });

    return res.status(200).json(visible);
});

/**
 * POST / — create a trip (no auth — bootstrap endpoint).
 * Creates seats (TripUsers without tokens), auto-claims the first seat
 * for the creator, and returns the trip + encodedId + creator credentials.
 * @body {object} - trip data with a `users` array (1-20 users)
 * @returns {object} - created trip with encodedId, seats, and creator credentials
 */
app.post("/", async (req, res) => {
    const { users } = req.body;
    if (users?.length === 0 || users?.length > 20)
        throw new InvalidError("Cannot create trip: a trip must have between 1 and 20 users");

    const tripUsers = await createTripUsers(users);
    const trip = await createTrip({ ...req.body, users: tripUsers });
    await trip.populate("users");

    // Auto-claim the first seat for the creator
    const claimed = await claimSeat(tripUsers[0]._id);

    const seats = tripUsers.map((u) => ({
        _id: u._id,
        name: u.name,
        avatar: u.avatar,
    }));

    return res.status(201).json({
        ...trip.toObject(),
        encodedId: encodeId(trip._id.toString()),
        seats,
        credentials: claimed
            ? { _id: claimed._id, name: claimed.name, token: claimed.token }
            : null,
    });
});

/**
 * GET /:tripId — get a single trip.
 * Public trip: anyone can read. Private trip: authenticated member only.
 * @param {string} tripId - encoded trip id
 * @returns {object} - trip with populated users
 */
app.get("/:tripId", optionalAuth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const includeStops = String(req.query?.includeStops).toLowerCase() === "true";
    const trip = await getTrip(rawId, includeStops);
    requireReadAccess(trip, req.user);
    await trip.populate("users");
    return res.status(200).json(trip);
});

/**
 * PUT /:tripId — update a trip (auth + membership required).
 * @param {string} tripId - encoded trip id
 * @body {object} - fields to update
 * @returns {object} - updated trip with populated users
 */
app.put("/:tripId", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    const savedTrip = await updateTrip(trip, req.body);
    await savedTrip.populate("users");
    return res.status(200).json(savedTrip);
});

/**
 * DELETE /:tripId — delete a trip (auth + membership required).
 * @param {string} tripId - encoded trip id
 */
app.delete("/:tripId", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);
    await deleteTrip(rawId);
    return res.status(204).send();
});

/**
 * GET /:tripId/dashboard — aggregated trip stats.
 * Public trip: anyone can read. Private trip: authenticated member only.
 * @param {string} tripId - encoded trip id
 * @returns {object} - dashboard data (stops, goods, events, polls, users, links)
 */
app.get("/:tripId/dashboard", optionalAuth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireReadAccess(trip, req.user);
    const result = await dashboard(trip, req.user?._id);
    return res.status(200).json(result);
});


/**
 * POST /:tripId/share — generate a share link (member only).
 * Private trip → returns a time-bounded join token.
 * Public trip → returns the encoded trip id (read capability).
 */
app.post("/:tripId/share", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);

    if (trip.isPrivate) {
        const joinToken = await generateJoinToken(rawId);
        return res.status(200).json({ value: joinToken, type: "joinToken" });
    }

    return res.status(200).json({
        value: encodeId(rawId),
        type: "encodedId",
    });
});

/**
 * POST /:tripId/join — claim a seat and get a token (no auth — bootstrap for new users).
 * @body {string} [joinToken] - required for private trips
 * @body {string} [tripUserId] - id of an existing free seat to claim
 * @body {string} [name] - for public trips: create a new seat with this name
 * @body {string} [avatar] - optional avatar for a new seat
 * @returns {object} - { user, token } or { anonymous: true }
 */
app.post("/:tripId/join", async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    const { joinToken = "", tripUserId, name, avatar } = req.body ?? {};

    if (trip.isPrivate) {
        if (!joinToken)
            throw new ForbiddenError("Join token required for private trips");
        await verifyJoinToken(joinToken, rawId);

        // Private: must pick an existing free seat
        if (!tripUserId)
            throw new InvalidError("Must select a seat to join a private trip");

        if (!trip.users.some((u) => u.toString() === String(tripUserId)))
            throw new ForbiddenError("This seat is not part of this trip");

        const claimed = await claimSeat(tripUserId);
        if (!claimed)
            throw new ForbiddenError("This seat is already taken");

        return res.status(200).json({
            user: { _id: claimed._id, name: claimed.name, avatar: claimed.avatar },
            token: claimed.token,
        });
    }

    // Public trip
    if (tripUserId) {
        // Claim an existing free seat
        if (!trip.users.some((u) => u.toString() === String(tripUserId)))
            throw new ForbiddenError("This seat is not part of this trip");

        const claimed = await claimSeat(tripUserId);
        if (!claimed)
            throw new ForbiddenError("This seat is already taken");

        return res.status(200).json({
            user: { _id: claimed._id, name: claimed.name, avatar: claimed.avatar },
            token: claimed.token,
        });
    }

    if (name) {
        // Create a new seat
        if (trip.users.length >= 20)
            throw new InvalidError("Cannot join: trip already has the maximum number of users");

        const newUser = await createTripUser({ name, avatar });
        trip.users.push(newUser._id);
        await trip.save();

        // Mint token on the new seat
        const claimed = await claimSeat(newUser._id);

        return res.status(200).json({
            user: { _id: claimed._id, name: claimed.name, avatar: claimed.avatar },
            token: claimed.token,
        });
    }

    // Pass — browse anonymously
    return res.status(200).json({ anonymous: true });
});

/**
 * POST /:tripId/leave — release the caller's seat (auth required).
 * Clears the token on the TripUser. The seat becomes free for someone else.
 * Content stays linked to the TripUser ObjectId.
 */
app.post("/:tripId/leave", auth, async (req, res) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    requireMembership(trip, req.user);

    await releaseSeat(req.user._id);
    return res.status(204).send();
});

export default app;
