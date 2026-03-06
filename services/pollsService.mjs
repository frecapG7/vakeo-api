import { DatesPoll, HousingPoll, OtherPoll, Poll } from "../models/pollModel.mjs";
import { InvalidError, NotFoundError } from "../utils/errors.mjs";
import { verifyDates, verifyUser } from "./validationService.mjs";




export const searchPolls = async (tripId, { limit, cursor, sort = "asc", excludeClosed = false }) => {

    let query = {
        trip: tripId,
        ...(excludeClosed && {isClosed: false})
    };

    if (cursor)
        query._id = sort === "asc" ? { $gt: cursor } : { $lt: cursor }

    
    const options = {
        limit,
        sort: {
            createdAt: sort === "asc" ? 1 : -1
        }
    }

    const polls = await Poll.find(query, null, options).populate("createdBy hasSelected options.selectedBy");
    return polls;
}




export const getPoll = async (tripId, pollId) => {

    const poll = await Poll.findOne({
        trip: tripId,
        _id: pollId
    }).populate({
        path: "options",
        populate: {
            path: "selectedBy",
            model: "TripUser"
        }
    }).exec();


    if (!poll)
        throw new NotFoundError("Cannot find poll");


    await poll.populate("createdBy");
    await poll.populate("hasSelected");
    return poll;
}


export const createPoll = async (trip, poll) => {

    verifyUser(trip, poll.createdBy);
    let newPoll;

    switch (poll?.type) {
        case "DatesPoll": {
            // verify dates are correct
            poll.options.forEach(({ startDate, endDate }) => verifyDates(startDate, endDate));
            newPoll = new DatesPoll({
                ...poll,
                trip
            });
            break;
        }
        case "HousingPoll": {
            //Verify no troll links ? 
            newPoll = new HousingPoll({
                ...poll,
                trip
            });
            break;
        }
        case "OtherPoll": {
            newPoll = new OtherPoll({
                ...poll,
                trip
            });
            break;
        }
        default: throw new InvalidError("Invalid poll type");
    }


    const savedPoll = await newPoll.save();
    await savedPoll.populate("createdBy");
    return savedPoll;
}

export const votePoll = async (trip, pollId, { options, user }) => {

    const poll = await Poll.findOne({
        trip: trip._id,
        _id: pollId,
        isClosed: false
    });

    if (!poll)
        throw new NotFoundError("Cannot find poll");

    verifyUser(trip, user);

    if (poll.isSingleAnswer && poll.hasSelected.contains(user))
        throw new InvalidError("User has already voted on a single answer poll");


    options?.forEach(option => {
        poll.options.filter(o => o._id.equals(option))
            .filter(o => !o.selectedBy.includes(user._id))
            .forEach(o => {
                o.selectedBy.push(user);
            });
    })

    const newPoll = await poll.save();

    await newPoll.populate("hasSelected");
    await newPoll.populate({
        path: "options",
        populate: {
            path: "selectedBy",
            model: "TripUser"
        }
    });
    await newPoll.populate("createdBy");

    return newPoll;
}

export const unvotePoll = async (trip, pollId, optionId, userId) => {

    const poll = await Poll.findOne({
        trip: trip._id,
        _id: pollId,
        isClosed: false
    });

    if (!poll)
        throw new NotFoundError("Cannot find poll");

    poll.options
        .filter(o => o._id.equals(optionId))
        .forEach(o => o.selectedBy = o.selectedBy.filter(user => !user._id.equals(userId)));

    const newPoll = await poll.save();
    await newPoll.populate("hasSelected");
    await newPoll.populate({
        path: "options",
        populate: {
            path: "selectedBy",
            model: "TripUser"
        }
    });
    await newPoll.populate("createdBy");

    return newPoll;
}

export const deletePoll = async (tripId, pollId, userId) => {

    const poll = await Poll.findOne({
        trip: tripId,
        _id: pollId,
        createdBy: userId
    });
    if (!poll)
        throw new NotFoundError("Cannot find poll");


    poll.isClosed = true;

    const newPoll = await poll.save();
    await newPoll.populate("hasSelected");
    await newPoll.populate({
        path: "options",
        populate: {
            path: "selectedBy",
            model: "TripUser"
        }
    });
    return newPoll;
}

