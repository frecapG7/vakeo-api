

import { createMessage, deleteMessage, search, getHubConversations, getUnreadConversationCount, markAllMessagesAsRead } from "../services/messageService.mjs";


import express from "express";
import passport from "passport";
import { getTrip } from "../services/tripService.mjs";
import { verifyUser } from "../services/validationService.mjs";
const app = express();


app.get("/trips/:id/messages", async (req, res) => {

    const tripId = req.params.id;

    const { cursor, limit = 10, eventId } = req.query;

    const messages = await search(tripId, cursor, limit, eventId);


    const prevCursor = messages.length > 0 ? messages[0]._id : null;
    const nextCursor = messages.length > 0 ? messages[messages.length - 1]._id : null;

    return res.status(200).json({
        nextCursor,
        prevCursor,
        totalResults: messages.length,
        messages
    });

});

app.get("/trips/:id/conversations",
    passport.authenticate(['user-header', 'anonymous'], { session: false, failWithError: false }),
    async (req, res) => {
        const trip = await getTrip(req.params.id);
        if (req.user?._id) {
            verifyUser(trip, req.user);
        }
        const userId = req.user?._id || null;
        const conversations = await getHubConversations(req.params.id, userId);
        return res.status(200).json({ conversations });
    }
);

app.get("/trips/:id/conversations/unread/count",
    passport.authenticate('user-header', { session: false }),
    async (req, res) => {
        const trip = await getTrip(req.params.id);
        verifyUser(trip, req.user);
        const count = await getUnreadConversationCount(req.params.id, req.user._id);
        return res.status(200).json({ count });
    }
);


app.post("/trips/:id/messages", async (req, res) => {
    const trip = await getTrip(req.params.id);

    const user = req.body?.user;
    verifyUser(trip, user);
    const savedMessage = await createMessage(trip, req.body);
    return res.status(201).json();
});

// V2 route with passport auth (x-user-id header)
app.post("/v2/trips/:id/messages",
    passport.authenticate('user-header', { session: false }),
    async (req, res) => {
        const trip = await getTrip(req.params.id);
        verifyUser(trip, req.user);
        const savedMessage = await createMessage(trip, {
            ...req.body,
            user: req.user._id
        });
        return res.status(201).json();
    }
);


app.delete("/trips/:id/messages/:messageId", async (req, res) => {
    const message = await deleteMessage(req.params.id, req.params.messageId, req.query.user);
    return res.status(200).json();
});

// Mark all messages in a trip (or event) as read
app.post("/trips/:id/messages/markAllAsRead",
    passport.authenticate('user-header', { session: false }),
    async (req, res) => {
        const { id: tripId } = req.params;
        const trip = await getTrip(tripId);
        verifyUser(trip, req.user);
        const { eventId } = req.query;
        await markAllMessagesAsRead(tripId, eventId, req.user._id);
        return res.status(200).json({ success: true });
    }
);

export default app;