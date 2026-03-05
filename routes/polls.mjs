import express from "express";
import { createPoll, deletePoll, getPoll, searchPolls, unvotePoll, votePoll } from "../services/pollsService.mjs";
import { getTrip } from "../services/tripService.mjs";
const app = express();


app.get("/trips/:tripId/polls", async (req, res) => {

    const {tripId} = req.params;
    const polls = await searchPolls(tripId, req.query);


    const prevCursor = polls.length > 0 ? polls[0]._id : null;
    const nextCursor = polls.length > 0 ? polls[polls.length - 1]._id : null;

    return res.status(200).json({
        nextCursor,
        prevCursor,
        totalResults: polls.length,
        polls
    });

});

app.get("/trips/:tripId/polls/:pollId", async (req , res) => {

    const {tripId, pollId} = req.params;
    const poll = await getPoll(tripId, pollId);
    return res.status(200).json(poll);
});

app.delete("/trips/:tripId/polls/:pollId", async (req , res) => {

    const {tripId, pollId} = req.params;
    const userId = req.headers["x-user-id"];
    const poll = await deletePoll(tripId, pollId, userId);
    return res.status(200).json(poll);
});


app.post("/trips/:tripId/polls", async (req, res) => {

    const {tripId} = req.params;
    const trip = await getTrip(tripId);
    const newPoll = await createPoll(trip, req.body);
    return res.status(201).json(newPoll);
})

app.patch("/trips/:tripId/polls/:pollId/vote", async (req, res) => {

    const {tripId, pollId} = req.params;
    const trip = await getTrip(tripId);

    const newPoll = await votePoll(trip, pollId, req.body);    
    return res.json(newPoll);

})


app.delete("/trips/:tripId/polls/:pollId/vote/:optionsId", async (req, res) => {

    const {tripId, pollId, optionsId} = req.params
    const trip = await getTrip(tripId);

    const userId = req.headers["x-user-id"];
    
    const newPoll = await unvotePoll(trip, pollId, optionsId, userId);
    return res.status(200).json(newPoll);

});


export default app;