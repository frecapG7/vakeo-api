import { ObjectId } from "mongodb";
import { DatesPoll, HousingPoll, OtherPoll, Poll } from "../models/pollModel.mjs";
import { InvalidError, NotFoundError } from "../utils/errors.mjs";
import { isValidUrl } from "../utils/validator.mjs";
import { verifyDates, verifyUser } from "./validationService.mjs";
import { POLL_MAX_OPTIONS } from "../utils/constants.mjs";
import TripStop from "../models/tripStopModel.mjs";


// Fields to select when populating user references
const USER_SELECT = "_id name avatar";

// Helper: Check if a user (or userId) exists in an array of users or userIds
const userInArray = (array, user) => {
    if (!array || !user) return false;

    const userId = user._id || user;

    return array.some(item => {
        const itemId = item._id || item;
        return itemId && userId && itemId.equals(userId);
    });
};

// Helper: Add user to a poll option's selectedBy array if not already present
const addUserToOption = (pollOption, userId) => {
    if (pollOption && !userInArray(pollOption.selectedBy, userId)) {
        pollOption.selectedBy.push(userId);
    }
};

// Helper: Fully populate a poll with all necessary references
const populatePollFull = async (poll) => {
    await poll.populate("hasSelected", USER_SELECT);
    await poll.populate({
        path: "options",
        populate: {
            path: "selectedBy",
            select: USER_SELECT,
            model: "TripUser"
        }
    });
    await poll.populate("createdBy", USER_SELECT);
    return poll;
};

export const searchPolls = async (tripId, { limit, cursor, sort = "asc", type, excludeClosed = false, excludeSelectedBy }) => {

    let query = {
        trip: tripId,
        ...(excludeClosed && { isClosed: false })
    };

    if (cursor) {
        try {
            const cursorId = new ObjectId(cursor);
            query._id = sort === "asc" ? { $gt: cursorId } : { $lt: cursorId };
        } catch (e) {
            throw new InvalidError("Invalid cursor format");
        }
    }

    if (type)
        query.type = type;
    if (excludeSelectedBy)
        query.hasSelected = { $nin: [excludeSelectedBy] }

    const options = {
        limit,
        sort: {
            _id: sort === "asc" ? 1 : -1
        }
    }

    const polls = await Poll.find(query, null, options)
        .populate([
            { path: "createdBy", select: USER_SELECT },
            { path: "hasSelected", select: USER_SELECT },
            { path: "options.selectedBy", select: USER_SELECT, model: "TripUser" },
            { path: "stop", select: "_id name" }
        ]);
    return polls;
}

export const getPoll = async (tripId, pollId) => {

    const poll = await Poll.findOne({
        trip: tripId,
        _id: pollId
    }).populate([
        { path: "createdBy", select: USER_SELECT },
        { path: "hasSelected", select: USER_SELECT },
        { path: "options.selectedBy", select: USER_SELECT, model: "TripUser" }
    ]).exec();

    if (!poll)
        throw new NotFoundError("Cannot find poll");

    return poll;
}


export const createPoll = async (trip, poll, user) => {

    verifyUser(trip, user);

    const { question, options, type, stop: stopId } = poll;
    if (options?.length > POLL_MAX_OPTIONS)
        throw new InvalidError(`Invalid poll options length: max is ${POLL_MAX_OPTIONS}`);

    const baseData = {
        question,
        trip: trip._id,
        createdBy: user._id,
        options,
        ...(stopId && { stop: stopId })
    };
    const session = await Poll.startSession();
    try {
        const savedPoll = await session.withTransaction(async () => {
            // Verify stop exists and belongs to trip
            let stop;
            if (stopId) {
                stop = await TripStop.findOne({
                    _id: stopId,
                    trip: trip._id
                }).session(session);
                if (!stop)
                    throw new InvalidError("Stop not found or does not belong to this trip");

            }

            let newPoll;
            switch (type) {
                case "DatesPoll": {
                    options.forEach(({ startDate, endDate }) => verifyDates(startDate, endDate));
                    newPoll = new DatesPoll(baseData);
                    break;
                }
                case "HousingPoll": {
                    newPoll = new HousingPoll(baseData);
                    break;
                }
                case "OtherPoll": {
                    newPoll = new OtherPoll(baseData);
                    break;
                }
                default: throw new InvalidError("Invalid poll type");
            }

            const savedPoll = await newPoll.save({ session });

            // Link poll to stop
            if (stop) {
                stop.polls.push(savedPoll._id);
                await stop.save({ session });
            }

            await savedPoll.populate("createdBy", USER_SELECT);
            return savedPoll;
        });
        return savedPoll;
    } finally {
        await session.endSession();
    }
}

export const updatePoll = async (trip, pollId, user, { newOptions = [] }) => {

    verifyUser(trip, user);

    const poll = await Poll.findOne({
        trip: trip._id,
        _id: pollId
    });

    if (!poll)
        throw new NotFoundError("Cannot find poll");
    if (poll.isClosed)
        throw new InvalidError("Cannot update a closed poll");

    if (newOptions.length === 0)
        return await populatePollFull(poll);

    if (poll.options.length + newOptions.length > POLL_MAX_OPTIONS)
        throw new InvalidError(`Maximum ${POLL_MAX_OPTIONS} options allowed`);

    switch (poll.type) {
        case "DatesPoll":
            newOptions.forEach(option => {
                verifyDates(option.startDate, option.endDate);
            });
            break;
        case "HousingPoll":
            newOptions.forEach(option => {
                if (!isValidUrl(option.url)) {
                    throw new InvalidError("Invalid URL format");
                }
            });
            break;
        case "OtherPoll":
            newOptions.forEach(option => {
                if (!option.value) {
                    throw new InvalidError("Option value is required");
                }
            });
            break;
        default:
            throw new InvalidError("Invalid poll type");
    }

    poll.options.push(...newOptions);

    const updatedPoll = await poll.save();
    return await populatePollFull(updatedPoll);
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

    if (poll.isSingleAnswer) {
        if (options?.length > 1) {
            throw new InvalidError("Single-answer poll allows only one option");
        }
        if (userInArray(poll.hasSelected, user)) {
            throw new InvalidError("User has already voted on this single-answer poll");
        }
    }

    options?.forEach(optionId => {
        const pollOption = poll.options.find(o => o._id.equals(optionId));
        addUserToOption(pollOption, user._id);
    });

    const newPoll = await poll.save();
    return await populatePollFull(newPoll);
}

export const unvotePoll = async (trip, pollId, optionId, userId) => {

    const poll = await Poll.findOne({
        trip: trip._id,
        _id: pollId,
        isClosed: false
    });

    if (!poll)
        throw new NotFoundError("Cannot find poll");

    verifyUser(trip, { _id: userId });

    const pollOption = poll.options.find(o => o._id.equals(optionId));
    if (pollOption) {
        pollOption.selectedBy = pollOption.selectedBy.filter(
            u => !userInArray([u], userId)
        );
    }

    const newPoll = await poll.save();
    return await populatePollFull(newPoll);
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
    return await populatePollFull(newPoll);
}

