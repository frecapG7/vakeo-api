
import express from "express";
import { getTrip } from "../services/tripService.mjs";
import { closeVote, createVote, getVote, searchVotes, updateVote } from "../app/services/votesService.mjs";
import { ForbiddenError, InvalidError } from "../utils/errors.mjs";


const app = express();

app.get("/trips/:tripId/votes", async (req, res) => {
    const { tripId } = req.params;

    const { limit = 10, status, cursor, sort } = req.query;

    const votes = await searchVotes(tripId, limit, status, cursor, sort);

    const prevCursor = votes.length > 0 ? votes[0]._id : null;
    const nextCursor = votes.length > 0 ? votes[votes.length - 1]._id : null;

    return res.status(200).json({
        nextCursor,
        prevCursor,
        totalResults: votes.length,
        votes
    });
});


app.get("/trips/:tripId/votes/:voteId", async (req, res) => {
    const { tripId, voteId } = req.params;

    const vote = await getVote(tripId, voteId);
    return res.status(200).json(vote);
})

app.post("/trips/:tripId/votes", async (req, res) => {
    const { tripId } = req.params;
    const trip = await getTrip(tripId);

    const vote = req.body;

    // Search for existing open vote
    const existingVotes = await searchVotes(tripId, 5, "OPEN");
    if(existingVotes.length > 1)
        throw new InvalidError("Cannot open a new votes until all previous one are closed");

    const newVote = await createVote(trip, vote);

    return res.status(201).json(newVote);
});

app.put("/trips/:tripId/votes/:voteId", async (req, res) => {
    const { tripId, voteId } = req.params;

    const vote = await getVote(tripId, voteId);
    const updatedVote = await updateVote(vote, req.body);

    return res.status(200).json(updatedVote);

});


app.put("/trips/:tripId/votes/:voteId/close", async (req, res) => {
    const { tripId, voteId } = req.params;

    const { user } = req.query;
    const vote = await getVote(tripId, voteId);

    if (!vote.createdBy._id.equals(user))
        throw new ForbiddenError("User is not allowed to close vote");

    const updatedVote = await closeVote(vote);

    return res.status(200).json(updatedVote);
})

export default app;