import Trip from "../models/tripModel.mjs";
import TripStop from "../models/tripStopModel.mjs";
import Good from "../models/goodModel.mjs";
import Event from "../models/eventModel.mjs";
import Link from "../models/linkModel.mjs";
import { Poll } from "../models/pollModel.mjs";
import { NotFoundError } from "../utils/errors.mjs";
import { sanitizeSearchText } from "../utils/pagination.mjs";
import { verifyDates } from "./validationService.mjs";
import TripUser from "../models/tripUserModel.mjs";
import { createTripUser } from "./tripUserService.mjs";

export const search = async ({ ids, search }) => {

  if (!ids)
    return [];

  const searchIds = ids.split(",");

  let query = {
    _id: { $in: searchIds },
  }
  const escapedSearch = sanitizeSearchText(search);
  if (escapedSearch)
    query.name = { $regex: escapedSearch, $options: "i" }

  const trips = await Trip.find(
    query,
    "users name image startDate endDate createdAt", {
    limit: 20,
    sort: {
      createdAt: -1
    }
  })
    .populate("users", "avatar name");

  return trips;

}

export const getTrip = async (id, includeStops = false) => {
  const trip = await Trip.findById(id);
  if (!trip)
    throw new NotFoundError(`Cannot find trip with id ${id}`);
  if (includeStops) {
    trip.stops = await TripStop.find({ trip: id })
      .populate("polls", "_id type question");
  }

  return trip;
}


export const createTrip = async ({ name, description, users, image, isPrivate }) => {
  const trip = new Trip({
    name,
    description,
    users,
    image,
    isPrivate
  });
  const savedTrip = await trip.save();

  return savedTrip;
}

export const updateTrip = async (trip, { name, description, users, image, startDate, endDate, location, isPrivate }) => {

  verifyDates(startDate, endDate);

  trip.name = name;
  trip.description = description;
  trip.image = image;
  trip.startDate = startDate;
  trip.endDate = endDate;
  trip.location = location;
  trip.isPrivate = isPrivate;

  const savedUsers = await Promise.all(users?.filter?.(user => !user._id)
    .map(user => createTripUser(user)));
  trip.users.push(...savedUsers.map(u => u._id));

  return await trip.save();
}


export const deleteTrip = async (id) => {

  const trip = await Trip.findByIdAndDelete(id);
  if (!trip)
    throw new NotFoundError(`Cannot find trip to delete with id ${id}`);
}


export const dashboard = async (trip, userId) => {
  const [stopsData, goodsData, eventsData, pollsData, usersData, linksData] = await Promise.all([
    stops(trip),
    goods(trip),
    events(trip, userId),
    polls(trip, userId),
    users(trip),
    links(trip)
  ]);

  return {
    stops: stopsData,
    goods: goodsData,
    events: eventsData,
    polls: pollsData,
    users: usersData,
    links: linksData
  };
}

const stops = async (trip) => {
  const [count, firstStop, lastStop] = await Promise.all([
    TripStop.countDocuments({ trip: trip._id }),
    TripStop.findOne({ trip: trip._id }, 'name', { sort: { createdAt: 1 } }),
    TripStop.findOne({ trip: trip._id }, 'name', { sort: { createdAt: -1 } })
  ]);

  return {
    count,
    first: firstStop?.name || null,
    last: lastStop?.name || null
  };
};

const goods = async (trip) => {
  const [missing, total] = await Promise.all([
    Good.countDocuments({ trip, checked: false }),
    Good.countDocuments({ trip }),
  ]);
  return { missing, total };
};

const events = async (trip, userId) => {
  const now = new Date();

  const [total, nextEvent, totalAttendings] = await Promise.all([
    Event.countDocuments({ trip: trip._id }),
    Event.findOne(
      { trip: trip._id, startDate: { $gte: now } },
      'name startDate endDate location description',
      { sort: { startDate: 1 } }
    ),
    userId ? Event.countDocuments({
      trip: trip._id,
      attendees: userId
    }) : 0
  ]);

  return { nextEvent, total, totalAttendings };
};

const users = async (trip) => {
  const result = await TripUser.aggregate([
    { $match: { _id: { $in: trip.users } } },
    { $unwind: "$restrictions" },
    { $group: { _id: null, unique: { $addToSet: "$restrictions" } } },
    { $project: { restrictionCount: { $size: "$unique" } } }
  ]);
  return { restrictionCount: result[0]?.restrictionCount || 0 };
};

const polls = async (trip, userId) => {
  const tripId = trip._id;
  const [openPollsCount, pendingPollsCount] = await Promise.all([
    Poll.countDocuments({
      trip: tripId,
      isClosed: false,
    }),
    userId ? Poll.countDocuments({
      trip: tripId,
      isClosed: false,
      hasSelected: { $nin: [userId] }
    }) : 0
  ]);

  return {
    openPollsCount,
    pendingPollsCount
  };
};


const links = async (tripId) => {
  const linksCount = await Link.countDocuments({
    trip: tripId
  });
  return {
    linksCount
  }
}