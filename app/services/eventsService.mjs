import Event from "../../models/eventModel.mjs";
import { NotFoundError } from "../../utils/errors.mjs";
import { verifyDates, verifyUser } from "./validationService.mjs";

export const search = async (tripId, cursor, limit, type, startDate, endDate) => {

    let query = {
        trip: tripId
    };

    if (cursor)
        query._id = { $gt: cursor };
    if (type)
        query.type = type;
    if (startDate)
        query.startDate = { $gt: startDate }
    if (endDate)
        query.endDate = { $lt: endDate }


    const options = {
        limit,
        sort: {
            createdAt: 1
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


export const createEvent = async (trip, { name, startDate, endDate, owners, attendees, type }) => {



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
        type
    });

    return await event.save();
}


export const updateEvent = async (event, { name, startDate, endDate, owners, attendees }) => {


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

    return await event.save();
}