import express from "express";
import { geocode } from "../services/geocoding/index.mjs";

const app = express();

app.get("/geocode", async (req, res) => {
    try {
        const result = await geocode(req.query.address)
        return res.status(200).json(result);
    } catch (err) {
        return res.status(500).json({
            message: err.message
        })
    }
});

export default app;

