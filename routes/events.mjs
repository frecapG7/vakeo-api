import express from "express";
import { getTrip } from "../services/tripService.mjs";
import { createEvent, getEvent, search, updateEvent } from "../app/services/eventsService.mjs";



const app = express();

app.get("/trips/:tripId/events", async (req, res) => {

    const tripId = req.params.tripId;

    const events = await search(tripId, req?.query);

    const totalResults = events?.length;
    const prevCursor = totalResults > 0 ? buidCursor(events[0]) : null;
    const nextCursor = totalResults > 0 ? buidCursor(events[events.length - 1]) : null;

    return res.status(200).json({
        nextCursor,
        prevCursor,
        totalResults,
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


/****************************************************************
 *                      PROTECTED METHODS
 * **************************************************************
 */
const buidCursor = (event) => {
    if (event.startDate)
        return `${event._id}_${event.startDate}`;
    return event._id;
}

export default app;