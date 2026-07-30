import express from "express";
import passport from "passport";
import { getTrip } from "../services/tripService.mjs";
import TripUser from "../models/tripUserModel.mjs";
import { createTripUser, getTripUserById } from "../services/tripUserService.mjs";
import { verifyUser } from "../services/validationService.mjs";
import { ForbiddenError } from "../utils/errors.mjs";

const app = express();

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

app.post("/trips/:tripId/users", async (req, res) => {
  const trip = await getTrip(req.params.tripId);
  if (trip.isPrivate)
    throw new ForbiddenError("Cannot add user on private trip");

  const newUser = await createTripUser(req.body);
  trip.users.push(newUser._id);

  const savedTrip = await trip.save();
  await savedTrip.populate("users");

  return res.status(200).json(savedTrip);
});

app.put("/trips/:tripId/users", async (req, res) => {
  const trip = await getTrip(req.params.tripId);

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

app.get("/trips/:tripId/users/:tripUserId", async (req, res) => {
  const trip = await getTrip(req.params.tripId);
  if (!trip.users.includes(req.params.tripUserId))
    throw new Error(`Error accessing trip user: user ${req.params.tripUserId} is no part of the trip ${trip._id}`);

  const user = await getTripUserById(req.params.tripUserId);
  return res.status(200).json(user);
});

app.put("/trips/:tripId/users/:tripUserId", async (req, res) => {
  const tripUserId = req.params.tripUserId;
  const trip = await getTrip(req.params.tripId);
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
