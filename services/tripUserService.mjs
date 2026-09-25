import mongoose from "mongoose";
import Trip from "../models/tripModel.mjs";
import { InvalidError } from "../utils/errors.mjs";
import TripUser from "../models/tripUserModel.mjs";
import crypto from "node:crypto";


export const getTripUserById = async (id) => {
    return await TripUser.findById(id);
}

/**
 * Look up a TripUser by id, including the token field.
 * Used by the migrate endpoint to check if a seat already has a token.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export const getTripUserWithToken = async (id) => {
    return await TripUser.findById(id).select("+token");
}

/**
 * Look up a TripUser by their secret token (v3 auth).
 * @param {string} token
 * @returns {Promise<object|null>}
 */
export const getTripUserByToken = async (token) => {
    if (!token) return null;
    return await TripUser.findOne({ token }).select("+token");
}

/**
 * Look up TripUsers by their secret tokens in a single query (batch hydrate).
 * @param {string[]} tokens
 * @returns {Promise<object[]>} the matching TripUsers, with token selected
 */
export const getTripUsersByTokens = async (tokens) => {
    if (!tokens?.length) return [];
    return await TripUser.find({ token: { $in: tokens } }).select("+token");
}

/**
 * Mint a fresh token for a TripUser, replacing the old one.
 * @param {string} tripUserId
 * @returns {Promise<string>} the new token
 */
export const rotateTripUserToken = async (tripUserId) => {
    const newToken = crypto.randomBytes(32).toString("base64url");
    const updated = await TripUser.findByIdAndUpdate(
        tripUserId,
        { token: newToken },
        { returnDocument: "after" }
    ).select("+token");
    return updated?.token ?? null;
}

/**
 * Atomically claim a free seat by minting a token on it.
 * Uses a conditional update so two simultaneous claims can't both succeed.
 * @param {string} tripUserId
 * @returns {Promise<object|null>} the TripUser with token, or null if already claimed
 */
export const claimSeat = async (tripUserId) => {
    const newToken = crypto.randomBytes(32).toString("base64url");
    const claimed = await TripUser.findOneAndUpdate(
        { _id: tripUserId, token: null },
        { token: newToken },
        { returnDocument: "after" }
    ).select("+token");
    return claimed;
}

/**
 * Release a seat by clearing its token. The seat becomes free for someone else.
 * @param {string} tripUserId
 * @returns {Promise<object|null>}
 */
export const releaseSeat = async (tripUserId) => {
    return await TripUser.findByIdAndUpdate(
        tripUserId,
        { $unset: { token: "" } },
        { returnDocument: "after" }
    );
}

export const createTripUsers = async (users = []) => {

    const newUsers = users.map(async (user) => createTripUser(user));
    const savedUsers = await Promise.all(newUsers);
    return savedUsers;
}

export const createTripUser = async (user, options = {}) => {
    const newUser = buildTripUser(user);
    return await newUser.save(options);
}


export const buildTripUser = ({name, avatar}) => {
    return new TripUser({
        name,
        avatar,
    });
}

/**
 * Create new seats and attach them to a trip in a single transaction.
 * Every entry is validated before any write; the seats are appended in one
 * conditional update that only matches while there is room for all of them,
 * so concurrent calls cannot exceed the 20-seat limit and a refused or
 * failed append rolls back the created TripUsers (no orphaned seats).
 * @param {string} tripId
 * @param {Array} users - [{ name, avatar }]
 * @returns {Promise<object[]>} the created TripUsers, in payload order
 */
export const addSeatsToTrip = async (tripId, users) => {
    if (!Array.isArray(users) || users.length === 0)
        throw new InvalidError("Cannot add users: `users` must be a non-empty array");
    for (const user of users) {
        if (user?._id)
            throw new InvalidError("Cannot add users: entries with `_id` are not supported — updates go through PUT /trips/:tripId/users/:tripUserId");
        if (!user?.name)
            throw new InvalidError("Cannot add user: `name` is required");
    }

    const session = await mongoose.startSession();
    let savedUsers = null;
    try {
        await session.withTransaction(async () => {
            savedUsers = [];
            const newIds = [];
            for (const user of users) {
                const newUser = await createTripUser(user, { session });
                newIds.push(newUser._id);
                savedUsers.push(newUser);
            }
            const result = await Trip.updateOne(
                { _id: tripId, $expr: { $lte: [{ $size: "$users" }, 20 - newIds.length] } },
                { $push: { users: { $each: newIds } } },
                { session }
            );
            if (result.modifiedCount === 0)
                throw new InvalidError("Cannot add user: trip already has the maximum number of users");
        });
        return savedUsers;
    } finally {
        await session.endSession();
    }
}