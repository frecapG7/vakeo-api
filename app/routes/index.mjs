import express from "express";
import trips from "./trips.mjs";
import activities from "./activities.mjs";
import links from "./links.mjs";
const app = express();

app.use("/trips", trips);
app.use("/trips/:id/activities", activities);
app.use("/trips/:id/links", links);

export default app;
