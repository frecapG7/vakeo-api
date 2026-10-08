import { getTrip } from "./tripService.mjs";
import { resolveEncodedTripId } from "./idEncoderService.mjs";

/**
 * Resolves the trip from the encoded route param, applies the access gate,
 * and returns the trip context (raw id + trip document).
 * @param {object} req - Express request carrying `params.tripId` and `user`
 * @param {Function} accessGate - requireReadAccess or requireMembership (validationService)
 */
export const loadTripContext = async (req, accessGate) => {
    const rawId = resolveEncodedTripId(req.params.tripId);
    const trip = await getTrip(rawId);
    accessGate(trip, req.user);
    return { rawId, trip };
};