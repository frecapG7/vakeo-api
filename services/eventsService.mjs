import mongoose from "mongoose";
import Event from "../models/eventModel.mjs";
import Good from "../models/goodModel.mjs";
import Message from "../models/messageModel.mjs";
import { buildEventCountIndex, readEventCounts } from "../utils/eventCounts.mjs";
import { NotFoundError } from "../utils/errors.mjs";
import { readCursor, sanitizeSearchText } from "../utils/pagination.mjs";
import { verifyDates, verifyUser } from "./validationService.mjs";

export const search = async (tripId, { cursor, limit = 10, type, startDate, endDate, attendee, owner, search }) => {

    let query = {
        trip: tripId
    };

    let lastStartDate;
    let lastId;
    if (cursor) {
        const cursorData = readCursor(cursor);
        if (cursorData) {
            lastId = cursorData?._id;
            lastStartDate = cursorData?.startDate;
        } else {
            const [startDate, _id] = cursor;
            lastId = _id;
            lastStartDate = startDate;
        }
    }
    if (type)
        query.type = type;

    if (startDate)
        query.startDate = { $gt: startDate }
    if (endDate)
        query.endDate = { $lt: endDate }
    if (attendee)
        query.attendees = attendee
    if (owner)
        query.owners = owner;
    const escapedSearch = sanitizeSearchText(search);
    if (escapedSearch)
        query.name = { $regex: escapedSearch, $options: "i" };

    if (lastId) {
        if (lastStartDate)
            query.$and = [
                { startDate: { $ne: null } },
                {
                    $or:
                        [
                            { startDate: { $gt: lastStartDate } },
                            { startDate: { $eq: lastStartDate }, _id: { $gt: lastId } }
                        ]
                }
            ]
        else
            query.$or = [
                { startDate: { $ne: null } },
                { startDate: { $eq: null }, _id: { $gt: lastId } }
            ]
    }

    const options = {
        limit,
        sort: {
            startDate: 1,
            _id: 1
        }
    };

    const events = await Event.find(query, null, options).populate("owners attendees")
    return events;
}


export const getEvent = async (tripId, id) => {

    const event = await Event.findOne({
        _id: id,
        trip: tripId
    }).populate("owners attendees");
    if (!event)
        throw new NotFoundError("Cannot find event");

    return event;
}


export const createEvent = async (trip, { name, startDate, endDate, owners, attendees, type, details }) => {

    verifyDates(startDate, endDate);
    owners?.forEach((owner) => verifyUser(trip, owner));
    attendees?.forEach((attendee) => verifyUser(trip, attendee));

    const event = new Event({
        name,
        trip,
        startDate,
        endDate,
        owners,
        attendees,
        type,
        details
    });

    return await event.save();
}


export const updateEvent = async (event, { name, startDate, endDate, owners, attendees, details }) => {


    await event.populate("trip");
    const trip = event.trip;

    verifyDates(startDate, endDate);
    owners?.forEach((owner) => verifyUser(trip, owner));
    attendees?.forEach((attendee) => verifyUser(trip, attendee));

    event.name = name;
    event.startDate = startDate;
    event.endDate = endDate;
    event.owners = owners;
    event.attendees = attendees;
    event.details = details;

    return await event.save();
}

const toObjectId = (value) =>
    mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(String(value)) : value;

// A GET response is a plain object: setting an unknown path on a mongoose
// document is silently dropped in strict mode, so counts would never serialize.
const toPlainEvent = (event) =>
    typeof event?.toObject === "function" ? event.toObject() : { ...event };

/**
 * Counts messages and goods for several events in two grouped aggregations,
 * whatever the page size. Events without any message or good simply have no
 * entry: the message index { trip, event, createdAt } and the good index
 * { trip, event } cover both $match stages.
 */
const buildCountIndex = async (tripId, eventIds) => {
    const ids = (eventIds ?? []).filter((id) => id != null).map(toObjectId);
    if (ids.length === 0)
        return new Map();

    const tripObjectId = toObjectId(tripId);

    const [messageStats, goodStats] = await Promise.all([
        Message.aggregate([
            { $match: { trip: tripObjectId, event: { $in: ids } } },
            {
                $group: {
                    _id: "$event",
                    messageCount: { $sum: 1 },
                    lastMessageAt: { $max: "$createdAt" }
                }
            }
        ]),
        Good.aggregate([
            { $match: { trip: tripObjectId, event: { $in: ids } } },
            {
                $group: {
                    _id: "$event",
                    total: { $sum: 1 },
                    missing: { $sum: { $cond: ["$checked", 0, 1] } }
                }
            }
        ])
    ]);

    return buildEventCountIndex(messageStats, goodStats);
};

/**
 * Returns the events as plain objects carrying messageCount, lastMessageAt and
 * goodsCount { total, missing }. Kept out of `search` and `getEvent`: the update
 * route needs the mongoose document back, not a decorated copy.
 */
export const withEventCounts = async (tripId, events) => {
    const list = events ?? [];
    const index = await buildCountIndex(tripId, list.map((event) => event?._id));

    return list.map((event) => ({
        ...toPlainEvent(event),
        ...readEventCounts(index, event?._id)
    }));
};

export const withEventCount = async (tripId, event) => {
    const [decorated] = await withEventCounts(tripId, [event]);
    return decorated;
}