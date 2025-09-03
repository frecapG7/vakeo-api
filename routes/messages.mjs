

import { createMessage, deleteMessage, search } from "../services/messageService.mjs";


import express from "express";
import { getTrip } from "../services/tripService.mjs";
const app = express();


app.get("/trips/:id/messages", async (req, res) => {

    const tripId = req.params.id;

    const { cursor, limit = 10 } = req.query;
   
    const messages = await search(tripId, cursor, limit);


    const prevCursor = messages.length > 0 ? messages[0]._id : null;
    const nextCursor = messages.length > 0 ? messages[messages.length - 1]._id : null;

    return res.status(200).json({
        nextCursor,
        prevCursor,
        totalResults: messages.length,
        messages
    });

});


app.post("/trips/:id/messages", async (req, res) => {
    const trip = await getTrip(req.params.id);

    const user = req.body?.user;
    if (!trip.users.includes(user._id))
        throw new Error(`Users ${user._id} is not part of trip ${trip._id}`);

    const savedMessage = await createMessage(trip, req.body); 
    return res.status(201).json();
});


app.delete("/trips/:id/messages/:messageId", async (req, res) => {
    const message = await deleteMessage(req.params.id, req.params.messageId, req.query.user);
    return res.status(200).json();
});

export default app;