import Event from "../models/eventModel.mjs";
import { NotFoundError } from "../utils/errors.mjs";
import { verifyDates, verifyUser } from "./validationService.mjs";

export const search = async (tripId, { cursor, limit = 10, type, startDate, endDate, attendee, owner, search }) => {

    let query = {
        trip: tripId
    };

    let lastStartDate;
    let lastId;
    if (cursor) {
        const [cursorId, cursorStartDate] = cursor.split("_");
        lastId = cursorId;
        lastStartDate = cursorStartDate;
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
    if (search)
        query.name = { $regex: search, $options: "i" };

    if (lastId) {
        if (lastStartDate)
            query.$and = [
                { startDate: { $ne: null } },
                {
                    $or:
                        [
                            { startDate: { $gt: lastStartDate } },
                            { startDate: { $eq: startDate }, _id: { $gt: lastId } }
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
            startDate: 1
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