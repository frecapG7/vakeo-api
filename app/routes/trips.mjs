import express from "express";
import { getTrip, createTrip } from "../services/tripsService.mjs";
const app = express();
app.get("/:id", async (req, res) => {
  const trip = await getTrip(req);
  return res.status(200).json(trip);
});

app.post("/", async (req, res) => {
  const trip = await createTrip(req);
  return res.status(201).json(trip);
});

export default app;
