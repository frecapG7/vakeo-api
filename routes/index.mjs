import express from "express";
import trips from "./trips.mjs";
import messages from "./messages.mjs";
import tokens from "./tokens.mjs";
import events from "./events.mjs";
import votes from "./votes.mjs";
import goods from "./goods.mjs";
import polls from "./polls.mjs";
const app = express();

app.use("/trips", trips);
app.use(messages)


app.use("/token", tokens);
app.use(events);
app.use(goods);


app.use(polls);
//Deprecated
app.use(votes);



export default app;
