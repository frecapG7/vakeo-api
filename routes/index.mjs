import express from "express";
import trips from "./trips.mjs";
import messages from "./messages.mjs";
import tokens from "./tokens.mjs";
import events from "./events.mjs";
import votes from "./votes.mjs";


import activities from "../app/routes/activities.mjs";
import links from "../app/routes/links.mjs";
import meals from "../app/routes/meals.mjs";
import groceries from "../app/routes/groceries.mjs";
const app = express();

app.use("/trips", trips);
app.use(messages)


app.use("/token", tokens);
app.use(events);
app.use(votes);

// Deprecated
app.use("/trips/:id/activities", activities);
app.use("/trips/:id/links", links);
app.use("/trips/:id/meals", meals);
app.use("/trips/:id/groceries", groceries);



export default app;
