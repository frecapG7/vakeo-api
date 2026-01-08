import Trip from "../models/tripModel.mjs";
import { Vote } from "../models/voteModel.mjs";
import Good from "../models/goodModel.mjs";
import Event from "../models/eventModel.mjs";
import { InvalidError, NotFoundError } from "../utils/errors.mjs";
import { verifyDates } from "./validationService.mjs";


export const getTrip = async (id) => {
    const trip = await Trip.findById(id);

    if (!trip)
        throw new NotFoundError(`Cannot find trip with id ${id}`);

    return trip;
}


export const createTrip = async (name, users, image) => {
    const trip = new Trip({
        name,
        users,
        image
    });
    const savedTrip = await trip.save();

    return savedTrip;
}


export const updateTrip = async (trip, { name, image, startDate, endDate }) => {


    verifyDates(startDate, endDate);

    trip.name = name;
    trip.image = image;
    trip.startDate = startDate;
    trip.endDate = endDate;

    return await trip.save();
}


export const deleteTrip = async (id) => {

    const trip = await Trip.findByIdAndDelete(id);
    if (!trip)
        throw new NotFoundError(`Cannot find trip to delete with id ${id}`);
}




export const dashboard = async (trip, user) => {

    // 1 - Récupération parallèle des données dynamiques
    const [pollsData, goodsData, eventsData] = await Promise.all([
        polls(trip),
        goods(trip),
        events(trip, user),
    ]);

    // 2 - Get Attendees data
    await trip.populate("users");

    const attendees = {
        total: trip?.users.length,
        restrictions: [...new Set(trip.users.flatMap(u => u.restrictions))]
    };


    return {
        polls: pollsData,
        attendees,
        goods: goodsData,
        events: eventsData,
        attendees
    };
}

const polls = async (trip) => {

    const pending = await Vote.countDocuments({
        trip,
        status: "OPEN"
    });
    const total = await Vote.countDocuments({
        trip,
    });

    return {
        pending,
        total
    };
}

const goods = async (trip) => {

    const missing = await Good.countDocuments({
        trip,
        checked: false
    });
    const total = await Good.countDocuments({
        trip,
    });

    return {
        missing,
        total
    }
}

const events = async (trip, user) => {
    const attending = await Event.countDocuments({
        trip,
        attendees: user
    });
    const ownership = await Event.countDocuments({
        trip,
        owner: user
    });
    const total = await Event.countDocuments({
        trip
    });

    return {
        attending,
        ownership,
        total
    }
}