import express from "express";
import trips from "./trips.mjs";
import tripStops from "./tripStops.mjs";
import messages from "./messages.mjs";
import tokens from "./tokens.mjs";
import events from "./events.mjs";
import votes from "./votes.mjs";
import goods from "./goods.mjs";
import polls from "./polls.mjs";
import linkPreview from "./link-preview.mjs";
import geocode from "./geocode.mjs";
const app = express();

app.use("/trips", trips);
app.use(tripStops);
app.use(messages)


app.use("/token", tokens);
app.use(events);
app.use(goods);


app.use(polls);
app.use(linkPreview);
app.use(geocode);

//Deprecated
app.use(votes);


export default app;
