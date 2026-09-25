import Trip from "../models/tripModel.mjs";
import TripStop from "../models/tripStopModel.mjs";
import Good from "../models/goodModel.mjs";
import Event from "../models/eventModel.mjs";
import Link from "../models/linkModel.mjs";
import { Poll } from "../models/pollModel.mjs";
import { InvalidError, NotFoundError } from "../utils/errors.mjs";
import { sanitizeSearchText } from "../utils/pagination.mjs";
import { resolveEncodedTripId } from "./idEncoderService.mjs";
import { getTripUsersByTokens } from "./tripUserService.mjs";
import { verifyDates } from "./validationService.mjs";
import TripUser from "../models/tripUserModel.mjs";

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
    "users name image startDate endDate createdAt isPrivate", {
    limit: 20,
    sort: {
      createdAt: -1
    }
  })
    .populate("users", "avatar name");

  return trips;

}

/**
 * Batch-hydrate trips for the v3 client, each entry carrying its own credential.
 * v3 identity is a per-trip seat token, so membership is proven per item.
 * - Fail-closed: malformed ids, missing `id`, or duplicated ids reject the whole
 *   batch (422) — no partial reads.
 * - Visibility is enforced inside the trips query: a seat belongs to a single
 *   trip, so holding a seat token proves membership, and private trips without
 *   one of the caller's seats never leave the database. Must stay in sync with
 *   `canReadTrip` (validationService).
 * - Invisible trips (not found, invalid token, non-member) are silently omitted;
 *   distinguishing them would leak the existence of private trips.
 * @param {Array} entries - [{ id: encoded trip id, token?: seat token }] (1-30 entries)
 * @returns {Promise<object[]>} trips the caller can read, users populated
 */
export const batchHydrate = async (entries) => {
  if (!Array.isArray(entries) || entries.length === 0)
    throw new InvalidError("Cannot fetch trips: `trips` must be a non-empty array");
  if (entries.length > 30)
    throw new InvalidError("Cannot fetch trips: batch is limited to 30 trips");

  // rawId -> seat token
  const entriesByRawId = new Map();
  for (const { id, token } of entries) {
    if (!id)
      throw new InvalidError("Cannot fetch trips: each entry requires an `id`");
    const rawId = resolveEncodedTripId(id);
    if (entriesByRawId.has(rawId))
      throw new InvalidError("Cannot fetch trips: duplicated `id` in batch");
    entriesByRawId.set(rawId, token ?? null);
  }

  const tokens = [...new Set([...entriesByRawId.values()].filter(Boolean))];
  const seats = await getTripUsersByTokens(tokens);

  const found = await Trip.find(
    {
      _id: { $in: [...entriesByRawId.keys()] },
      $or: [
        { isPrivate: { $ne: true } },
        { users: { $in: seats.map((s) => s._id) } }
      ]
    },
    "users name image startDate endDate createdAt isPrivate"
  ).populate("users", "avatar name");

  // Respond in batch order
  const byId = new Map(found.map((t) => [String(t._id), t]));
  return [...entriesByRawId.keys()]
    .filter((rawId) => byId.has(rawId))
    .map((rawId) => byId.get(rawId));
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