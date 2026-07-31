import express from "express";
import passport from "passport";
import { getTrip } from "../services/tripService.mjs";
import TripUser from "../models/tripUserModel.mjs";
import { createTripUser, getTripUserById } from "../services/tripUserService.mjs";
import { verifyUser } from "../services/validationService.mjs";
import { ForbiddenError, InvalidError } from "../utils/errors.mjs";

const app = express();

/**
 * GET /trips/:tripId/users
 * Get all users for a trip
 * @param {string} tripId - Trip ID
 * @returns {object[]} - Array of trip users
 */
app.get("/trips/:tripId/users",
  passport.authenticate('user-header', { session: false, failWithError: false }),
  async (req, res) => {
    const trip = await getTrip(req.params.tripId);
    const userId = req.user?._id;

    if (trip.isPrivate) {
      if (!userId) throw new ForbiddenError("Private trip requires authenticated user");
      verifyUser(trip, { _id: userId });
    }

    const users = await TripUser.find({ _id: { $in: trip.users } });
    return res.status(200).json(users);
  }
);

/**
 * POST /trips/:tripId/users
 * Add a new user to a trip (public trips only)
 * @param {string} tripId - Trip ID
 * @body {object} - Trip user data
 * @returns {object} - Updated trip with users populated
 */
app.post("/trips/:tripId/users", async (req, res) => {
  const trip = await getTrip(req.params.tripId);
  if (trip.isPrivate)
    throw new ForbiddenError("Cannot add user on private trip");
  if (trip.users.length >= 20)
    throw new InvalidError("Cannot add user: trip already has the maximum number of users")

  const newUser = await createTripUser(req.body);
  trip.users.push(newUser._id);

  const savedTrip = await trip.save();
  await savedTrip.populate("users");

  return res.status(200).json(savedTrip);
});

/**
 * PUT /trips/:tripId/users
 * Bulk update users for a trip (auth required)
 * @param {string} tripId - Trip ID
 * @body {object[]} users - Array of user updates/creations
 * @returns {object[]} - Array of updated/created users
 */
app.put("/trips/:tripId/users",
  passport.authenticate('user-header', { session: false, failWithError: false }),
  async (req, res) => {
    const trip = await getTrip(req.params.tripId);
    const userId = req.user?._id;

    if (trip.isPrivate) {
      if (!userId) throw new ForbiddenError("Private trip requires authenticated user");
      verifyUser(trip, { _id: userId });
    }

    const users = req.body.users.map(async (user) => {
      let dbUser;
      if (user._id) {
        if (!trip.users.includes(user._id))
          throw new Error(`Cannot update list of users: user ${user._id} is no part of the trip ${trip._id}`);
        dbUser = await getTripUserById(user._id);
      } else {
        dbUser = await createTripUser(user);
        trip.users.push(dbUser);
      }
      dbUser.name = user.name;
      dbUser.avatar = user.avatar;
      return await dbUser.save();
    });

    const savedUsers = await Promise.all(users);
    await trip.save();

    return res.status(200).json(savedUsers);
  });

/**
 * GET /trips/:tripId/users/:tripUserId
 * Get a single trip user by ID (auth required for private trips)
 * @param {string} tripId - Trip ID
 * @param {string} tripUserId - Trip user ID
 * @returns {object} - The requested trip user
 */
app.get("/trips/:tripId/users/:tripUserId",
  passport.authenticate('user-header', { session: false, failWithError: false }),
  async (req, res) => {
    const trip = await getTrip(req.params.tripId);

    if (trip.isPrivate) {
      if (!req.user) throw new ForbiddenError("Private trip requires authenticated user");
      verifyUser(trip, req.user);
    }

    verifyUser(trip, { _id: req.params.tripUserId })

    const user = await getTripUserById(req.params.tripUserId);
    return res.status(200).json(user);
  });

/**
 * PUT /trips/:tripId/users/:tripUserId
 * Update a single trip user (auth required)
 * @param {string} tripId - Trip ID
 * @param {string} tripUserId - Trip user ID
 * @body {string} name - User name
 * @body {string} avatar - User avatar
 * @body {object} restrictions - User restrictions
 * @returns {object} - The updated trip user
 */
app.put("/trips/:tripId/users/:tripUserId",
  passport.authenticate('user-header', { session: false }),
  async (req, res) => {
    const tripUserId = req.params.tripUserId;
    const trip = await getTrip(req.params.tripId);
    verifyUser(trip, req.user);

    if (!trip.users.includes(tripUserId))
      throw new Error(`Error accessing trip user: user ${tripUserId} is no part of the trip ${trip._id}`);

    const user = await getTripUserById(tripUserId);

    const { name, avatar, restrictions } = req.body;
    user.name = name;
    user.avatar = avatar;
    user.restrictions = restrictions;

    const savedUser = await user.save();
    return res.status(200).json(savedUser);
  });

export default app;
