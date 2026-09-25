import express from "express";
import { getTrip } from "../../services/tripService.mjs";
import { getTripUserWithToken, claimSeat } from "../../services/tripUserService.mjs";
import { encodeId } from "../../services/idEncoderService.mjs";
import { InvalidError, ForbiddenError, NotFoundError } from "../../utils/errors.mjs";
import mongoose from "mongoose";

const app = express();

/**
 * POST /migrate — temporary endpoint for the v1→v3 frontend cutover.
 *
 * The frontend stores raw trip ObjectIds and authenticates with x-user-id.
 * This endpoint bridges that to v3: it accepts a raw trip ObjectId,
 * returns the encoded trip id, and optionally mints a token for a legacy user.
 *
 * @header {string} [x-user-id] - legacy TripUser ObjectId (optional)
 * @body {string} tripId - raw trip ObjectId
 * @returns {object} - { encodedId, user?, token? }
 *
 * To be removed once the frontend has fully migrated to v3.
 */
app.post("/", async (req, res) => {
    const { tripId } = req.body ?? {};
    const legacyUserId = req.get("x-user-id");

    if (!tripId)
        throw new InvalidError("tripId is required");
    if (!mongoose.Types.ObjectId.isValid(tripId))
        throw new InvalidError("Invalid tripId format");

    const trip = await getTrip(tripId);

    if (!legacyUserId)
        return res.status(200).json({ encodedId: encodeId(trip._id.toString()) });

    if (!mongoose.Types.ObjectId.isValid(legacyUserId))
        throw new InvalidError("Invalid x-user-id format");

    if (!trip.users.some((u) => u.toString() === String(legacyUserId)))
        throw new ForbiddenError("This user is not part of this trip");

    // Try to claim the seat (mints a token atomically if the seat is free)
    const claimed = await claimSeat(legacyUserId);
    if (claimed)
        return res.status(200).json({
            encodedId: encodeId(trip._id.toString()),
            user: { _id: claimed._id, name: claimed.name },
            token: claimed.token,
        });

    // Seat already claimed — return the existing token (idempotent migration)
    const tripUser = await getTripUserWithToken(legacyUserId);
    if (!tripUser)
        throw new NotFoundError("TripUser not found");

    return res.status(200).json({
        encodedId: encodeId(trip._id.toString()),
        user: { _id: tripUser._id, name: tripUser.name },
        token: tripUser.token,
    });
});

export default app;
