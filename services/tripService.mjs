import Trip from "../models/tripModel.mjs";
import TripStop from "../models/tripStopModel.mjs";
import Good from "../models/goodModel.mjs";
import Event from "../models/eventModel.mjs";
import { NotFoundError } from "../utils/errors.mjs";
import { verifyDates } from "./validationService.mjs";
import { createTripUser } from "./tripUserService.mjs";

export const search = async ({ ids, search }) => {

    if (!ids)
        return [];

    const searchIds = ids.split(",");


    let query = {
        _id: { $in: searchIds },
    }
    if (search)
        query.name = { $regex: search, $options: "i" }

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
  const [stopsData, goodsData, eventsData] = await Promise.all([
    stops(trip),
    goods(trip),
    events(trip, userId),
  ]);

  return {
    stops: stopsData,
    goods: goodsData,
    events: eventsData,
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
      null,
      { sort: { startDate: 1 } }
    ),
    userId ? Event.countDocuments({
      trip: trip._id,
      attendees: userId
    }) : 0
  ]);

  return { nextEvent, total, totalAttendings };
};