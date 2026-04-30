import Trip from "../models/tripModel.mjs";
import { NotFoundError, InvalidError } from "../utils/errors.mjs";

// Get all stops for a trip
const getTripStops = async (tripId) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new NotFoundError(`Trip ${tripId} not found`);
  return trip.stops || [];
};

// Get a specific stop
const getTripStop = async (tripId, stopId) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new NotFoundError(`Trip ${tripId} not found`);
  
  const stop = trip.stops.id(stopId);
  if (!stop) throw new NotFoundError(`Stop ${stopId} not found in trip ${tripId}`);
  return stop;
};

// Create a new stop
const createTripStop = async (tripId, stopData) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new NotFoundError(`Trip ${tripId} not found`);
  
  // Validate stops limit (50)
  if (trip.stops.length >= 50) {
    throw new InvalidError("Cannot add more than 50 stops to a trip");
  }
  
  trip.stops.push(stopData);
  await trip.save();
  return trip.stops[trip.stops.length - 1];
};

// Update a stop
const updateTripStop = async (tripId, stopId, stopData) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new NotFoundError(`Trip ${tripId} not found`);
  
  const stop = trip.stops.id(stopId);
  if (!stop) throw new NotFoundError(`Stop ${stopId} not found in trip ${tripId}`);
  
  Object.assign(stop, stopData);
  await trip.save();
  return stop;
};

// Delete a stop
const deleteTripStop = async (tripId, stopId) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new NotFoundError(`Trip ${tripId} not found`);
  
    // Filter out the stop with the matching ID
  trip.stops = trip.stops?.filter(stop => !stop._id.equals(stopId));
  await trip.save();
};

export {
  getTripStops,
  getTripStop,
  createTripStop,
  updateTripStop,
  deleteTripStop,
};