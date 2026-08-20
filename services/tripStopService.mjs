import Trip from "../models/tripModel.mjs";
import TripStop from "../models/tripStopModel.mjs";
import Link from "../models/linkModel.mjs";
import { Poll } from "../models/pollModel.mjs";
import { NotFoundError, InvalidError } from "../utils/errors.mjs";
import { verifyUser } from "./validationService.mjs";


const normalizeAccommodation = async (accommodationId, tripId) => {
  if (!accommodationId) return null;

  const link = await Link.findOne({
    _id: accommodationId,
    trip: tripId,
    type: 'accommodation'
  });
  if (!link) throw new InvalidError("Accommodation link not found or invalid type");

  return accommodationId;
};

// Get all stops for a trip
const getTripStops = async (tripId) => {
  const stops = await TripStop.find({ trip: tripId })
    .populate({
      path: "polls",
      select: "_id type question hasSelected",
      populate: { path: "hasSelected", select: "_id name avatar" }
    })
    .populate("accommodation")
  return stops || [];
};

// Get a specific stop
const getTripStop = async (tripId, stopId) => {
  const stop = await TripStop.findOne({
    _id: stopId,
    trip: tripId
  }).populate([
    {
      path: "polls",
      select: "_id type question hasSelected",
      populate: { path: "hasSelected", select: "_id name avatar" }
    },
    { path: "createdBy", select: "_id name avatar" },
    { path: "modifiedBy", select: "_id name avatar" },
    { path: "accommodation" }
  ]);

  if (!stop) throw new NotFoundError(`Stop ${stopId} not found in trip ${tripId}`);
  return stop;
};

const createTripStop = async (tripId, stop, user) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new NotFoundError(`Trip ${tripId} not found`);
  verifyUser(trip, user);

  const stopCount = await TripStop.countDocuments({ trip: tripId });
  if (stopCount >= 50) {
    throw new InvalidError("Cannot add more than 50 stops to a trip");
  }

  const { name, location, accommodation } = stop;

  const accommodationId = await normalizeAccommodation(accommodation?._id ?? accommodation, tripId);

  const newStop = await new TripStop({
    name,
    location,
    accommodation: accommodationId,
    trip: tripId,
    createdBy: user._id,
    modifiedBy: user._id
  }).save();

  return newStop;
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
    accommodation: newAccommodation
  } = stopData;

  if (newAccommodation !== undefined) {
    const idToValidate = newAccommodation?._id ?? newAccommodation;
    stop.accommodation = idToValidate ? await normalizeAccommodation(idToValidate, tripId) : null;
  }

  stop.name = name;
  stop.location = location;
  stop.modifiedBy = user._id;

  await stop.save();
  await stop.populate([{
    path: "polls",
    select: "_id type question hasSelected",
    populate: { path: "hasSelected", select: "_id name avatar" }
  },
  {
    path: "accommodation"
  }]);
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


