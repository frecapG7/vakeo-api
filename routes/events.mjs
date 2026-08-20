import express from "express";
import { getTrip } from "../services/tripService.mjs";
import { createEvent, getEvent, search, updateEvent } from "../services/eventsService.mjs";
import { sanitizeLimit } from "../utils/pagination.mjs";



const app = express();

app.get("/trips/:tripId/events", async (req, res) => {

    const tripId = req.params.tripId;

    const { limit = 10 } = req?.query;
    const sanitizedLimit = sanitizeLimit(limit);
    const events = await search(tripId, {
        ...req?.query,
        limit: sanitizedLimit
    });

    const nextCursor = events?.length === sanitizedLimit ? buildCursor({
        _id: events[events.length - 1]?._id,
        startDate: events[events.length - 1]?.startDate
    }) : null;

    return res.status(200).json({
        nextCursor,
        totalResults: events?.length,
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
// const buildCursor = (event) => {
//     if (event.startDate)
//         return `${event._id}_${event.startDate}`;
//     return event._id;
// }

// export default app;