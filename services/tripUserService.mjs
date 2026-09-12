import TripUser from "../models/tripUserModel.mjs";
import crypto from "node:crypto";


export const getTripUserById = async (id) => {
    return await TripUser.findById(id);
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

export const createTripUser = async (user) => {
    const newUser = buildTripUser(user);
    return await newUser.save()
}


export const buildTripUser = ({name, avatar}) => {
    return new TripUser({
        name,
        avatar,
    });
}