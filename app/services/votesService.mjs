import { DatesVote, Vote } from "../../models/voteModel.mjs"
import { InvalidError, NotFoundError } from "../../utils/errors.mjs";
import { verifyDates, verifyUser } from "./validationService.mjs";

export const searchVotes = async (tripId, limit, cursor, sort = "asc") => {

    let query = {
        trip: tripId
    };

    if (cursor)
        query._id = sort === "asc" ? { $gt: cursor } : { $lt: cursor }

    const options = {
        limit,
        sort: {
            createdAt: sort === "asc" ? 1 : -1
        }
    }

    const votes = await Vote.find(query, null, options).populate("createdBy");
    return votes;
}

export const getVote = async (tripId, voteId) => {
    const vote = await Vote.findOne({
        _id: voteId,
        trip: tripId,
    }).populate({
        path: "votes",
        populate: {
            path: "users",
            model: "TripUser"
        }
    }).exec();
    await vote.populate("createdBy");
    if (!vote)
        throw new NotFoundError("Cannot find vote");

    return vote;
}

export const createVote = async (trip, vote) => {
    const { createdBy, type, votes } = vote;

    verifyUser(trip, createdBy);
    if (type === "DATES") {
        votes.forEach(({ startDate, endDate }) => verifyDates(startDate, endDate));
        const datesVote = new DatesVote({
            trip,
            createdBy,
            votes
        });
        return await datesVote.save();
    } else {
        throw new InvalidError("Unknwon vote type " + type);
    }

}



export const updateVote = async (vote, body) => {
    if (vote.status === "CLOSED")
        throw new InvalidError("Cannot update closed vote");

    const { votes } = body;
    if (vote.type === "DATES")
        votes.forEach(({ startDate, endDate }) => verifyDates(startDate, endDate));

    vote.votes = votes;

    return await vote.save();
}


export const closeVote = async (vote) => {
    if (vote.status === "CLOSED")
        throw new InvalidError("Cannot update closed vote");

    vote.status = "CLOSED";
    //TODO: maybe record results of vote so changing attendees size will not affect this closed vote

    return await vote.save();
}