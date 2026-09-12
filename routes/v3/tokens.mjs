import express from "express";
import { getTrip } from "../../services/tripService.mjs";
import { verifyJoinTokenAnyTrip } from "../../services/joinTokenService.mjs";
import { decodeId, encodeId } from "../../services/idEncoderService.mjs";
import TripUser from "../../models/tripUserModel.mjs";
import { InvalidError } from "../../utils/errors.mjs";

const app = express();

/**
 * GET /:value — resolve a share token into trip info + available seats.
 *
 * Tries to resolve in this order:
 *   1. joinToken (JWT with role: "join") — private trips
 *   2. encodedId (AES-256-GCM) — public trips
 *
 * Returns everything the frontend needs to show the join screen:
 *   { type, encodedId, trip: { name, image, isPrivate }, availableSeats }
 *
 * @param {string} value - the share token from the URL
 */
app.get("/:value", async (req, res) => {
    const { value } = req.params;
    let tripId = null;
    let type = null;

    // Try joinToken (JWT) first — private trips
    try {
        const payload = await verifyJoinTokenAnyTrip(value);
        tripId = payload.sub;
        type = "joinToken";
    } catch {
        // Not a joinToken, try encodedId — public trips
        try {
            tripId = decodeId(value);
            type = "encodedId";
        } catch {
            throw new InvalidError("Invalid share token");
        }
    }

    const trip = await getTrip(tripId);

    // Find available (free) seats
    const users = await TripUser.find({ _id: { $in: trip.users } }).select("+token");
    const availableSeats = users
        .filter((u) => !u.token)
        .map((u) => ({ _id: u._id, name: u.name, avatar: u.avatar }));

    return res.status(200).json({
        type,
        encodedId: encodeId(trip._id.toString()),
        trip: {
            _id: trip._id,
            name: trip.name,
            image: trip.image,
            isPrivate: trip.isPrivate,
        },
        availableSeats,
    });
});

export default app;
