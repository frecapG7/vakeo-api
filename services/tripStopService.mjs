import Trip from "../models/tripModel.mjs";
import TripStop from "../models/tripStopModel.mjs";
import { Poll } from "../models/pollModel.mjs";
import { NotFoundError, InvalidError } from "../utils/errors.mjs";
import { verifyUser } from "./validationService.mjs";

// Get all stops for a trip
const getTripStops = async (tripId) => {
  const stops = await TripStop.find({ trip: tripId })
    .populate("polls", "_id type question");
  return stops || [];
};

// Get a specific stop
const getTripStop = async (tripId, stopId) => {
  const stop = await TripStop.findOne({
    _id: stopId,
    trip: tripId
  }).populate([
    { path: "polls", select: "_id type question" },
    { path: "createdBy", select: "_id name avatar" },
    { path: "modifiedBy", select: "_id name avatar" }
  ]);

  if (!stop) throw new NotFoundError(`Stop ${stopId} not found in trip ${tripId}`);
  return stop;
};

// Create a new stop
const createTripStop = async (tripId, stop, user) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new NotFoundError(`Trip ${tripId} not found`);

  verifyUser(trip, user)

  // Validate stops limit (50)
  const stopCount = await TripStop.countDocuments({ trip: tripId });
  if (stopCount >= 50) {
    throw new InvalidError("Cannot add more than 50 stops to a trip");
  }
  const { polls, ...safeData } = stop;

  return await TripStop.create({
    ...safeData,
    trip: tripId
  });
};

// Update a stop
const updateTripStop = async (tripId, stopId, stopData, user) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new NotFoundError(`Trip ${tripId} not found`);

  verifyUser(trip, user);

  const stop = await TripStop.findOne({ _id: stopId, trip: tripId });
  if (!stop) throw new NotFoundError(`Stop ${stopId} not found in trip ${tripId}`);

  // Explicit assignment of allowed fields only
  const {
    name = stop.name,
    location = stop.location,
    accommodation = stop.accommodation
  } = stopData;

  stop.name = name;
  stop.location = location;
  stop.accommodation = accommodation;
  stop.modifiedBy = user._id;

  await stop.save();
  await stop.populate("polls", "_id type question");
  return stop;
};

// Delete a stop
const deleteTripStop = async (tripId, stopId, user) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new NotFoundError(`Trip ${tripId} not found`);

  verifyUser(trip, user);

  const stop = await TripStop.findOne({ _id: stopId, trip: tripId }).populate("polls");
  if (!stop) throw new NotFoundError(`Stop ${stopId} not found in trip ${tripId}`);

  if (stop.polls.filter(p => !p.isClosed).length > 0)
    throw new InvalidError("Cannot delete a stop with existing polls");

  const result = await TripStop.deleteOne({ _id: stopId, trip: tripId });
  if (result.deletedCount === 0)
    throw new NotFoundError(`Stop ${stopId} not found in trip ${tripId}`);
};

export {
  getTripStops,
  getTripStop,
  createTripStop,
  updateTripStop,
  deleteTripStop,
};