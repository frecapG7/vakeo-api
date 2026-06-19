import express from "express";
import passport from "passport";
import {
  getTripStop,
  createTripStop,
  deleteTripStop,
  updateTripStop,
  getTripStops,
} from "../services/tripStopService.mjs";
import Trip from "../models/tripModel.mjs";
import { ForbiddenError } from "../utils/errors.mjs";

const app = express();


const verifyUser = async(tripId, userId) => {
    const exist = await Trip.exists({
      _id: tripId,
      users: userId
    });

  if(!exist)
    throw new ForbiddenError("User is not part of the trip")
}

// Get all stops for a trip
app.get("/trips/:tripId/stops", async (req, res) => {
  const stops = await getTripStops(req.params.tripId);
  return res.status(200).json(stops);
});

// Get a specific stop
app.get("/trips/:tripId/stops/:stopId", async (req, res) => {
  const stop = await getTripStop(req.params.tripId, req.params.stopId);
  return res.status(200).json(stop);
});

// Create a new stop
app.post("/trips/:tripId/stops",passport.authenticate('user-header', { session: false }), async (req, res) => {
  await verifyUser(req.params.tripId, req.user?._id);
  const stop = await createTripStop(req.params.tripId, req.body);
  return res.status(201).json(stop);
});

// Update a stop
app.put("/trips/:tripId/stops/:stopId",passport.authenticate('user-header', { session: false }), async (req, res) => {
  await verifyUser(req.params.tripId, req.user?._id);
  const stop = await updateTripStop(
    req.params.tripId,
    req.params.stopId,
    req.body
  );
  return res.status(200).json(stop);
});

// Delete a stop
app.delete("/trips/:tripId/stops/:stopId", passport.authenticate('user-header', { session: false }), async (req, res) => {
  await verifyUser(req.params.tripId, req.user?._id);
  await deleteTripStop(req.params.tripId, req.params.stopId);
  return res.status(204).send();
});

export default app;