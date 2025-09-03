import express from "express";
import { getTrip, createTrip, deleteTrip } from "../services/tripService.mjs";
import {  createTripUser, createTripUsers, getTripUserById} from "../services/tripUserService.mjs";
const app = express();





app.get("/:id", async (req, res) => {
  const trip = await getTrip(req.params.id);

  await trip.populate("users");
  return res.status(200).json(trip);
});

app.post("/", async (req, res) => {
  // Check all users have unique key
  const users = req.body.users;
  if (users?.length < 2 && users?.length > 20)
    throw new Error("Cannot create trip: a trip must have between 2 and 20 users");

  const tripUsers = await createTripUsers(users);
  const trip = await createTrip(req.body.name, tripUsers);
  return res.status(201).json(trip);
});

app.put("/:id", async (req, res) => {
  const trip = await getTrip(req.params.id);

  const { name, startDate, endDate } = req.body;

  trip.name = name;
  trip.startDate = startDate;
  trip.endDate = endDate;

  const savedTrip = await trip.save();

  return res.status(200).json(savedTrip);
});



app.put("/:id/users", async (req, res) => {

  const trip = await getTrip(req.params.id);

  const users = req.body.users.map(async (user) => {
    let dbUser
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

app.delete("/:id", async (req, res) => {
  const trip = await deleteTrip(req.params.id);
  return res.status(200);
})



export default app;
