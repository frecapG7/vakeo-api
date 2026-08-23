import Trip from "../models/tripModel.mjs";
import TripStop from "../models/tripStopModel.mjs";
import Link from "../models/linkModel.mjs";
import { NotFoundError, InvalidError } from "../utils/errors.mjs";
import { verifyUser } from "./validationService.mjs";
import mongoose from "mongoose";

const syncAccommodation = async (tripId, previousAccommodation, nextAccommodation, session) => {
  // 1 - If accommodation was removed
  if (nextAccommodation === null) {
    if (previousAccommodation?._id)
      await Link.deleteOne({
        _id: previousAccommodation._id,
        trip: tripId,
        type: 'accommodation'
      }, { session });
    return null;
  }
  // 2 - accommodation was added
  else if (!previousAccommodation?._id) {
    const newLink = await new Link({
      url: nextAccommodation?.url,
      title: nextAccommodation?.title,
      icon: nextAccommodation?.icon,
      image: nextAccommodation?.image,
      description: nextAccommodation?.description,
      type: "accommodation",
      trip: tripId
    }).save({ session });
    return newLink._id;
  }
  // 3 - accommodation was updated
  else {
    const link = await Link.findOneAndUpdate({
      _id: previousAccommodation._id,
      trip: tripId,
      type: "accommodation"
    }, {
      url: nextAccommodation?.url,
      title: nextAccommodation?.title,
      icon: nextAccommodation?.icon,
      image: nextAccommodation?.image,
      description: nextAccommodation?.description,
    }, { session, new: true });
    return link._id;
  }
}

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

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const accommodationId = await syncAccommodation(tripId, null, accommodation, session);
    const newStop = await new TripStop({
      name,
      location,
      accommodation: accommodationId,
      trip: tripId,
      createdBy: user._id,
      modifiedBy: user._id
    }).save({ session });
    await session.commitTransaction();
    return newStop;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};


// Update a stop
const updateTripStop = async (tripId, stopId, stopData, user) => {
  const trip = await Trip.findById(tripId);
  if (!trip) throw new NotFoundError(`Trip ${tripId} not found`);

  verifyUser(trip, user);

  const stop = await TripStop.findOne({ _id: stopId, trip: tripId }).populate("accommodation");
  if (!stop) throw new NotFoundError(`Stop ${stopId} not found in trip ${tripId}`);

  // Explicit assignment of allowed fields only
  const {
    name = stop.name,
    location = stop.location,
    accommodation: newAccommodation
  } = stopData;


  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    if (newAccommodation !== undefined)
      stop.accommodation = await syncAccommodation(tripId, stop?.accommodation, newAccommodation, session);
    stop.name = name;
    stop.location = location;
    stop.modifiedBy = user._id;

    const newStop = await stop.save({ session });
    await session.commitTransaction();

    await newStop.populate([{
      path: "polls",
      select: "_id type question hasSelected",
      populate: { path: "hasSelected", select: "_id name avatar" }
    },
    {
      path: "accommodation"
    }]);
    return newStop;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
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

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const accommodationId = stop.accommodation?._id ?? stop.accommodation; // Work if field is populated or not 
    if (accommodationId)
      await Link.deleteOne({
        _id: accommodationId,
        trip: tripId,
        type: "accommodation"
      }, { session });
    const result = await TripStop.deleteOne({ _id: stopId, trip: tripId }, { session });
    if (result.deletedCount === 0)
      throw new NotFoundError(`Stop ${stopId} not found in trip ${tripId}`);

    await session.commitTransaction();

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }

};

export {
  getTripStops,
  getTripStop,
  createTripStop,
  updateTripStop,
  deleteTripStop,
};


