import Trip from "../models/tripModel.mjs";
import TripStop from "../models/tripStopModel.mjs";
import { NotFoundError, InvalidError } from "../utils/errors.mjs";

// Get all stops for a trip
const getTripStops = async (tripId) => {
  const stops = await TripStop.find({trip : tripId})
      .populate("polls", "_id type question");
  return stops || [];
};

// Get a specific stop
const getTripStop = async (tripId, stopId) => {
  const stop = await TripStop.findOne({
      _id: stopId,
      trip: tripId
  }).populate("polls", "_id type question");
  
  if (!stop) throw new NotFoundError(`Stop ${stopId} not found in trip ${tripId}`);
  return stop;
};

// Create a new stop
const createTripStop = async (tripId, stopData) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new NotFoundError(`Trip ${tripId} not found`);
  
  // Validate stops limit (50)
  const stopCount = await TripStop.countDocuments({ trip: tripId });
  if (stopCount >= 50) {
    throw new InvalidError("Cannot add more than 50 stops to a trip");
  }
  
  return await TripStop.create({
      ...stopData,
      trip: tripId
  });
};

// Update a stop
const updateTripStop = async (tripId, stopId, stopData) => {
  const { polls, ...safeData } = stopData;
  
  const stop = await TripStop.findOneAndUpdate(
      { _id: stopId, trip: tripId },
      safeData,
      { new: true }
  ).populate("polls", "_id type question");
  
  if (!stop) throw new NotFoundError(`Stop ${stopId} not found in trip ${tripId}`);
  return stop;
};

// Delete a stop
const deleteTripStop = async (tripId, stopId) => {
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