import { InvalidError, ForbiddenError } from "../utils/errors.mjs";


export const verifyDates = (startDate, endDate) => {
    const hasStartDate = !!startDate;
    const hasEndDate = !!endDate;

    if (!hasStartDate && !hasEndDate) return;

    if (hasStartDate !== hasEndDate) {
        throw new InvalidError("StartDate and endDate both must be provided or omitted together.");
    }

    if (startDate > endDate) {
        throw new InvalidError("startDate cannot be after endDate");
    }
}


export const verifyUser = (trip, user) => {
    if (!trip.users.some(u => u.toString() === String(user?._id)))
        throw new ForbiddenError(`Users ${user?._id} is not part of trip ${trip._id}`);
}


/**
 * Require that `user` is an authenticated member of `trip`.
 * Throws ForbiddenError if the user is missing or not in trip.users.
 * Used by v3 routes on mutations — always requires a member.
 * @param {object} trip - Trip document with a `users` array of ObjectIds
 * @param {object|null} user - Authenticated TripUser document (or null/anonymous)
 */
export const requireMembership = (trip, user) => {
    if (!user?._id)
        throw new ForbiddenError("Authentication required");
    if (!trip.users.some(u => u.toString() === String(user._id)))
        throw new ForbiddenError(`User ${user._id} is not part of trip ${trip._id}`);
}

/**
 * Gate for v3 read endpoints.
 * - Public trip: anyone can read (anonymous OK).
 * - Private trip: must be an authenticated member.
 * @param {object} trip - Trip document with `isPrivate` and `users`
 * @param {object|null} user - Authenticated TripUser document (or null/anonymous)
 */
export const requireReadAccess = (trip, user) => {
    if (canReadTrip(trip, user))
        return;
    if (!user?._id)
        throw new ForbiddenError("Authentication required");
    throw new ForbiddenError(`User ${user._id} is not part of trip ${trip._id}`);
}
/**
 * Gate for seat-scoped actions (v3): only the seat's owner may act.
 * Targeting another member's seat requires a privileged role — v3 has no
 * role system, so every other-target request is refused. Extend this gate
 * when roles (UserAccount) are introduced.
 * @param {object} user - authenticated TripUser
 * @param {string} targetTripUserId - seat targeted by the request
 */
export const requireSeatOwnership = (user, targetTripUserId) => {
    if (String(user?._id) !== String(targetTripUserId))
        throw new ForbiddenError("Only the seat owner can perform this action");
}

/**
 * Non-throwing read check, for batch reads that filter instead of rejecting.
 * Public trip: anyone. Private trip: only an authenticated member seat.
 * Handles both raw ObjectIds and populated TripUser documents in `trip.users`.
 * @param {object} trip - Trip document with `isPrivate` and `users`
 * @param {object|null} user - Authenticated TripUser (or null/anonymous)
 * @returns {boolean} true if the trip may be returned to this caller
 */
export const canReadTrip = (trip, user) => {
    if (!trip?.isPrivate)
        return true;
    if (!user?._id)
        return false;
    return (trip.users || []).some(u => String(u?._id ?? u) === String(user._id));
}
