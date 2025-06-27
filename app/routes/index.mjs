import express from "express";
import trips from "./trips.mjs";
import activities from "./activities.mjs";
import links from "./links.mjs";
import meals from "./meals.mjs";
const app = express();

app.use("/trips", trips);
app.use("/trips/:id/activities", activities);
app.use("/trips/:id/links", links);
app.use("/trips/:id/meals", meals);

export default app;
