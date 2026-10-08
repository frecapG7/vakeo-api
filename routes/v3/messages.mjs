import express from "express";
import {
    createMessage, deleteMessage, search,
    getHubConversations, getUnreadConversationCount, markAllMessagesAsRead,
    addReaction, removeReaction,
} from "../../services/messageService.mjs";
import { loadTripContext } from "../../services/tripContextService.mjs";
import { requireMembership, requireReadAccess } from "../../services/validationService.mjs";
import { auth, optionalAuth } from "./auth.mjs";
import { buildNextCursor, sanitizeLimit } from "../../utils/pagination.mjs";

const app = express();


/**
 * GET /trips/:tripId/messages — list messages for a trip.
 * Public trip: anyone. Private trip: member only.
 */
app.get("/trips/:tripId/messages", optionalAuth, async (req, res) => {
    const { rawId } = await loadTripContext(req, requireReadAccess);
    const { cursor, limit = 10 } = req.query;
    const sanitizedLimit = sanitizeLimit(limit);
    const messages = await search(rawId, cursor, sanitizedLimit);
    const nextCursor = buildNextCursor(messages, sanitizedLimit, ['_id', 'createdAt']);
    return res.status(200).json({ nextCursor, totalResults: messages?.length, messages });
});

/**
 * GET /trips/:tripId/messages/general — general messages (eventId: null).
 */
app.get("/trips/:tripId/messages/general", optionalAuth, async (req, res) => {
    const { rawId } = await loadTripContext(req, requireReadAccess);
    const { cursor, limit = 10 } = req.query;
    const sanitizedLimit = sanitizeLimit(limit);
    const messages = await search(rawId, cursor, sanitizedLimit, null);
    const nextCursor = buildNextCursor(messages, sanitizedLimit, ['_id', 'createdAt']);
    return res.status(200).json({ nextCursor, totalResults: messages?.length, messages });
});

/**
 * GET /trips/:tripId/events/:eventId/messages — event-specific messages.
 */
app.get("/trips/:tripId/events/:eventId/messages", optionalAuth, async (req, res) => {
    const { rawId } = await loadTripContext(req, requireReadAccess);
    const { cursor, limit = 10 } = req.query;
    const sanitizedLimit = sanitizeLimit(limit);
    const messages = await search(rawId, cursor, sanitizedLimit, req.params.eventId);
    const nextCursor = buildNextCursor(messages, sanitizedLimit, ['_id', 'createdAt']);
    return res.status(200).json({ nextCursor, totalResults: messages?.length, messages });
});

/**
 * GET /trips/:tripId/conversations — list conversations (auth required for private).
 */
app.get("/trips/:tripId/conversations", optionalAuth, async (req, res) => {
    const { rawId } = await loadTripContext(req, requireReadAccess);
    const userId = req.user?._id || null;
    const conversations = await getHubConversations(rawId, userId);
    return res.status(200).json({ conversations });
});

/**
 * GET /trips/:tripId/conversations/unread/count — unread count (member only).
 */
app.get("/trips/:tripId/conversations/unread/count", auth, async (req, res) => {
    const { rawId } = await loadTripContext(req, requireMembership);
    const count = await getUnreadConversationCount(rawId, req.user._id);
    return res.status(200).json({ count });
});

/**
 * POST /trips/:tripId/messages — create a message (member only).
 */
app.post("/trips/:tripId/messages", auth, async (req, res) => {
    const { trip } = await loadTripContext(req, requireMembership);
    await createMessage(trip, { ...req.body, user: req.user._id });
    return res.status(201).json();
});

/**
 * DELETE /trips/:tripId/messages/:messageId — delete a message (member only).
 */
app.delete("/trips/:tripId/messages/:messageId", auth, async (req, res) => {
    const { rawId } = await loadTripContext(req, requireMembership);
    await deleteMessage(rawId, req.params.messageId, req.user._id);
    return res.status(200).json();
});
/**
 * POST /trips/:tripId/messages/:messageId/reactions — react to a message (member only).
 * Body: { emoji } — must be one of ALLOWED_REACTIONS (messageService).
 */
app.post("/trips/:tripId/messages/:messageId/reactions", auth, async (req, res) => {
    const { rawId } = await loadTripContext(req, requireMembership);
    const reactions = await addReaction(rawId, req.params.messageId, req.user._id, req.body?.emoji);
    return res.status(200).json({ reactions });
});

/**
 * DELETE /trips/:tripId/messages/:messageId/reactions — remove a reaction (member only).
 * Body (or query param): { emoji }. Idempotent.
 */
app.delete("/trips/:tripId/messages/:messageId/reactions", auth, async (req, res) => {
    const { rawId } = await loadTripContext(req, requireMembership);
    const reactions = await removeReaction(rawId, req.params.messageId, req.user._id, req.body?.emoji ?? req.query?.emoji);
    return res.status(200).json({ reactions });
});

/**
 * POST /trips/:tripId/messages/markAllAsRead — mark all messages as read (member only).
 */
app.post("/trips/:tripId/messages/markAllAsRead", auth, async (req, res) => {
    const { rawId } = await loadTripContext(req, requireMembership);
    await markAllMessagesAsRead(rawId, req.user._id);
    return res.status(200).json({ success: true });
});

/**
 * POST /trips/:tripId/messages/general/markAllAsRead — mark general messages as read (member only).
 */
app.post("/trips/:tripId/messages/general/markAllAsRead", auth, async (req, res) => {
    const { rawId } = await loadTripContext(req, requireMembership);
    await markAllMessagesAsRead(rawId, req.user._id, null, true);
    return res.status(200).json({ success: true });
});

/**
 * POST /trips/:tripId/events/:eventId/messages/markAllAsRead — mark event messages as read (member only).
 */
app.post("/trips/:tripId/events/:eventId/messages/markAllAsRead", auth, async (req, res) => {
    const { rawId } = await loadTripContext(req, requireMembership);
    await markAllMessagesAsRead(rawId, req.user._id, req.params.eventId);
    return res.status(200).json({ success: true });
});

export default app;
