import express from "express";
import { getTrip, createTrip, deleteTrip } from "../services/tripService.mjs";
const app = express();





app.get("/:id", async (req, res) => {
  const trip = await getTrip(req.params.id);
  return res.status(200).json(trip);
});

app.post("/", async (req, res) => {
  const trip = await createTrip(req.body);
  return res.status(201).json(trip);
});


app.delete("/:id", async (req, res) => {
    const trip = await deleteTrip(req.params.id);
    return res.status(200);
})



export default app;
