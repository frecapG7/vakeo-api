import express from "express";
import { getTrip } from "../services/tripService.mjs";
import { createEvent, getEvent, search, updateEvent } from "../app/services/eventsService.mjs";



const app = express();

app.get("/trips/:tripId/events", async (req, res) => {

    const tripId = req.params.tripId;

    const { cursor, limit = 10, type, startDate, endDate, sort } = req.query;

    const events = await search(tripId, cursor, limit, type, startDate, endDate, sort);

    const prevCursor = events.length > 0 ? events[0]._id : null;
    const nextCursor = events.length > 0 ? events[events.length - 1]._id : null;

    return res.status(200).json({
        nextCursor,
        prevCursor,
        totalResults: events.length,
        events
    });
});



app.post("/trips/:tripId/events", async (req, res) => {

    const trip = await getTrip(req.params.tripId);

    const event = await createEvent(trip, req.body);

    return res.status(201).json(event);

});


app.get("/trips/:tripId/events/:id", async (req, res) => {
    const event = await getEvent(req.params.tripId, req.params.id);
    return res.status(200).json(event);
});

app.put("/trips/:tripId/events/:id", async (req, res) => {

    const event = await getEvent(req.params.tripId, req.params.id);

    const updatedEvent = await updateEvent(event, req.body);

    return res.status(200).json(updatedEvent);

});



app.delete("/trips/:tripId/events/:id", async (req, res) => {

    const event = await getEvent(req.params.tripId, req.params.id);

    const { user } = req.query;

    if (event?.owners?.filter(u => u._id.equals(user)).length === 0)
        throw new Error("Forbidden actions");

    await event.deleteOne();
    return res.status(204).json({});
});


export default app;