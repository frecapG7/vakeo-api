import mongoose from "mongoose";

/**
 * A moderation report filed by a trip member against another member's message.
 *
 * Standalone collection rather than an array on Message, on purpose:
 * - the unique (message, reporter) index makes "one report per member" atomic,
 * - no `reports` path ever rides along a message projection, so the reported
 *   author cannot learn who reported them from the message endpoints,
 * - reports survive the message deletion (`deleteMessage` hard-deletes),
 * - the moderation queue is a plain indexed query on (trip, createdAt).
 *
 * Two entry points feed it: the seat-token route (identified reporter) and the
 * public /reports route (anonymous, reporter null).
 */
export const MESSAGE_REPORT_REASONS = ["spam", "harassment", "illicit", "other"];

export const MESSAGE_REPORT_STATUSES = ["pending", "reviewed", "dismissed"];

const messageReportSchema = new mongoose.Schema({
    message: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
        required: true
    },
    // Denormalised from the message so the moderation queue never joins.
    trip: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Trip",
        required: true
    },
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TripUser",
        // null = public channel report (any individual, no seat — DSA art. 16).
        required: false
    },
    reason: {
        type: String,
        enum: MESSAGE_REPORT_REASONS,
        required: true
    },
    comment: {
        type: String,
        maxlength: 500,
        required: false
    },
    // Snapshot of the reported text: the author can delete their message after
    // being reported, the report must still carry what was reported.
    messageText: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: MESSAGE_REPORT_STATUSES,
        default: "pending"
    }
}, {
    timestamps: true
});

// Anti-doublon: at most one report per (message, reporter). Partial on purpose:
// public channel reports carry `reporter: null`, and a plain unique index would
// collapse every anonymous report of a message into a single row.
messageReportSchema.index(
    { message: 1, reporter: 1 },
    { unique: true, partialFilterExpression: { reporter: { $type: "objectId" } } }
);
// Moderation queue: a trip's reports, newest first.
messageReportSchema.index({ trip: 1, createdAt: -1 });

export default mongoose.model("MessageReport", messageReportSchema);
