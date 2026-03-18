import express from "express";
import { getTrip } from "../services/tripService.mjs";
import { createEvent, getEvent, search, updateEvent } from "../services/eventsService.mjs";
import { geocode } from "../services/geocoding/index.mjs";



const app = express();

app.get("/geocode", async (req, res) => {
    try {
        const result = await geocode(req.query.address)
        return res.status(200).json(result);
    } catch (err) {
        return res.status(200).json({
            message: "no results"
        })
    }
});

export default app;

