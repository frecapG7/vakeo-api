import express from "express";
import { getTrip, getOrCreateEncodedId } from "../../services/tripService.mjs";
import { verifyJoinTokenAnyTrip } from "../../services/joinTokenService.mjs";
import TripUser from "../../models/tripUserModel.mjs";
import { InvalidError } from "../../utils/errors.mjs";

const app = express();

/**
 * GET /:value — resolve a universal share token into trip info + available seats.
 *
 * The token is always a JWT join token containing { sub: tripId, role: "join" }.
 * Returns everything the frontend needs to show the join screen:
 *   { type, encodedId, trip: { name, image, isPrivate }, availableSeats }
 *
 * @param {string} value - the share token from the URL
 */
app.get("/:value", async (req, res) => {
    const { value } = req.params;

    const payload = await verifyJoinTokenAnyTrip(value);
    const tripId = payload.sub;
    const trip = await getTrip(tripId);

    // Find available (free) seats
    const users = await TripUser.find({ _id: { $in: trip.users } }).select("+token");
    const availableSeats = users
        .filter((u) => !u.token)
        .map((u) => ({ _id: u._id, name: u.name, avatar: u.avatar }));

    return res.status(200).json({
        type: "joinToken",
        encodedId: await getOrCreateEncodedId(trip),
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
