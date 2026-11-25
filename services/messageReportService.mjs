import mongoose from "mongoose";
import Message from "../models/messageModel.mjs";
import MessageReport, { MESSAGE_REPORT_REASONS } from "../models/messageReportModel.mjs";
import { ForbiddenError, InvalidError, NotFoundError } from "../utils/errors.mjs";

export { MESSAGE_REPORT_REASONS };

const COMMENT_MAX_LENGTH = 500;

const assertValidReason = (reason) => {
    if (!MESSAGE_REPORT_REASONS.includes(reason)) {
        throw new InvalidError(`Reason must be one of: ${MESSAGE_REPORT_REASONS.join(", ")}`);
    }
};

// Optional free-text: trimmed, nulled when empty, capped at COMMENT_MAX_LENGTH.
const normalizeComment = (comment) => {
    if (comment === undefined || comment === null)
        return null;
    if (typeof comment !== "string")
        throw new InvalidError("Comment must be a string");
    const trimmed = comment.trim();
    if (trimmed.length > COMMENT_MAX_LENGTH)
        throw new InvalidError(`Comment must be at most ${COMMENT_MAX_LENGTH} characters`);
    return trimmed.length > 0 ? trimmed : null;
};

/**
 * File a report against a message of the trip.
 * Idempotent per (message, reporter): a second report returns the existing one
 * with `alreadyReported: true` instead of throwing, so the client can settle
 * its "already reported" state without an error path.
 * @returns {Promise<{ report: object, alreadyReported: boolean }>}
 */
export const reportMessage = async (tripId, messageId, reporterId, { reason, comment } = {}) => {
    assertValidReason(reason);
    const normalizedComment = normalizeComment(comment);

    if (!mongoose.Types.ObjectId.isValid(messageId))
        throw new NotFoundError(`Message ${messageId} not found`);

    const message = await Message.findOne({ _id: messageId, trip: tripId }, "text user");
    if (!message)
        throw new NotFoundError(`Message ${messageId} not found`);
    if (String(message.user) === String(reporterId))
        throw new ForbiddenError("You cannot report your own message");

    try {
        const report = await MessageReport.create({
            message: message._id,
            trip: tripId,
            reporter: reporterId,
            reason,
            comment: normalizedComment,
            messageText: message.text
        });
        return { report, alreadyReported: false };
    } catch (error) {
        if (error?.code !== 11000)
            throw error;
        // Unique (message, reporter) index tripped: the report already exists.
        const existing = await MessageReport.findOne({ message: messageId, reporter: reporterId });
        return { report: existing, alreadyReported: true };
    }
};

/**
 * Ids, among `messageIds`, that `reporterId` already reported in this trip.
 * Backs the `reportedByMe` flag of the message lists. One indexed query per
 * listing; no-op for anonymous callers.
 * @returns {Promise<Set<string>>}
 */
export const getReportedMessageIds = async (tripId, reporterId, messageIds = []) => {
    if (!reporterId || messageIds.length === 0)
        return new Set();

    const ids = await MessageReport.distinct("message", {
        trip: tripId,
        reporter: reporterId,
        message: { $in: messageIds }
    });
    return new Set(ids.map(String));
};

/**
 * Public channel — no seat required (DSA art. 16: any individual or entity must
 * be able to notify illegal content). No identity is stored, so no anti-doublon
 * is possible either: several anonymous reports of one message stay separate
 * rows, and they are triage signals that never justify a decision on their own.
 *
 * The outcome is deliberately uniform — `{ received: true }` for an unknown or
 * malformed message id as well, so the endpoint is not an existence oracle.
 * @returns {Promise<{ received: true }>}
 */
export const reportMessageAnonymously = async (messageId, { reason, comment } = {}) => {
    assertValidReason(reason);
    const normalizedComment = normalizeComment(comment);

    if (!mongoose.Types.ObjectId.isValid(messageId))
        return { received: true };

    const message = await Message.findOne({ _id: messageId }, "text trip");
    if (!message)
        return { received: true };

    await MessageReport.create({
        message: message._id,
        trip: message.trip,
        reporter: null,
        reason,
        comment: normalizedComment,
        messageText: message.text
    });
    return { received: true };
};
