import { jwtVerify, SignJWT } from "jose";
import config from "../config.mjs";
import { ForbiddenError } from "../utils/errors.mjs";

const secret = new TextEncoder().encode(config.token_secret);

/**
 * Generate a time-bounded join token for a private trip.
 * The token encodes `{ sub: tripId, role: "join" }` and is valid for `expiresIn`.
 * Reusable within its lifetime; regenerable by the owner.
 * @param {string} tripId - raw trip ObjectId
 * @param {string} expiresIn - JWT expiry (default 7d)
 * @returns {Promise<string>} signed JWT
 */
export const generateJoinToken = async (tripId, expiresIn = "7d") => {
    return await new SignJWT({ sub: String(tripId), role: "join" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(secret);
};

/**
 * Verify a join token for a specific trip.
 * Checks signature, expiry, and that `sub` matches the expected trip id.
 * @param {string} token - the join token JWT
 * @param {string} expectedTripId - the raw trip id from the URL
 * @returns {Promise<object>} the JWT payload if valid
 * @throws {ForbiddenError} if expired, tampered, or wrong trip
 */
export const verifyJoinToken = async (token, expectedTripId) => {
    try {
        const { payload } = await jwtVerify(token, secret);
        if (payload.role !== "join")
            throw new ForbiddenError("Invalid join token: wrong role");
        if (expectedTripId !== undefined && payload.sub !== String(expectedTripId))
            throw new ForbiddenError("Invalid join token: trip mismatch");
        return payload;
    } catch (err) {
        if (err instanceof ForbiddenError) throw err;
        throw new ForbiddenError("Invalid or expired join token");
    }
};

/**
 * Verify a join token without knowing the expected trip id.
 * Used by the token resolution endpoint to extract the tripId from the token.
 * @param {string} token - the join token JWT
 * @returns {Promise<object>} the JWT payload if valid (contains `sub` = tripId)
 * @throws {ForbiddenError} if expired, tampered, or wrong role
 */
export const verifyJoinTokenAnyTrip = async (token) => {
    return verifyJoinToken(token);
};
