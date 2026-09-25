import express from "express";
import trips from "./trips.mjs";
import tokens from "./tokens.mjs";
import tripStops from "./tripStops.mjs";
import polls from "./polls.mjs";
import goods from "./goods.mjs";
import links from "./links.mjs";
import messages from "./messages.mjs";
import tripUsers from "./tripUsers.mjs";
import events from "./events.mjs";
import migrate from "./migrate.mjs";

const app = express();

/**
 * v3 router — the secure surface.
 * Routes mounted here enforce token-based auth (user-token strategy) and
 * membership via requireMembership on mutations, requireReadAccess on reads.
 * Trip ids are encoded (resolveEncodedTripId); raw ObjectIds stay internal.
 */

app.use("/trips", trips);
app.use("/token", tokens);
app.use(tripStops);
app.use(polls);
app.use(goods);
app.use(links);
app.use(messages);
app.use(tripUsers);
app.use(events);
app.use("/migrate", migrate);

export default app;
