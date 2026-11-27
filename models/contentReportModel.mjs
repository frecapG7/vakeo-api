import mongoose from "mongoose";

/**
 * A moderation report filed against one piece of user-generated content of a
 * trip: a chat message, an event, the trip itself, a seat, a stop, a poll, a
 * link or a good. DSA art. 16 puts every "specific item of information" on the
 * same footing, so the collection is content-agnostic.
 *
 * Standalone collection rather than an array on the reported document, on
 * purpose:
 * - the unique (subjectType, subjectId, reporter) index makes "one report per
 *   member and per item" atomic,
 * - no `reports` path ever rides along a projection of the reported document,
 *   so the author cannot learn who reported them from the normal endpoints,
 * - reports survive the hard delete of the reported document (messages are
 *   deleted with findOneAndDelete),
 * - the moderation queue is a plain indexed query on (trip, createdAt).
 *
 * Two entry points feed it: the seat-token route (identified reporter) and the
 * public /reports route (anonymous, reporter null).
 */
export const CONTENT_REPORT_SUBJECTS = [
    "message",
    "event",
    "trip",
    "tripUser",
    "tripStop",
    "poll",
    "link",
    "good"
];

export const CONTENT_REPORT_REASONS = ["spam", "harassment", "illicit", "other"];

export const CONTENT_REPORT_STATUSES = ["pending", "reviewed", "dismissed"];

const contentReportSchema = new mongoose.Schema({
    subjectType: {
        type: String,
        enum: CONTENT_REPORT_SUBJECTS,
        required: true
    },
    // Polymorphic: points into the collection named by subjectType. Kept as a
    // bare ObjectId (no ref) — the subject model is resolved by the service,
    // which also runs the trip-scoping rules.
    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    // Denormalised so the moderation queue never joins on the subject.
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
        enum: CONTENT_REPORT_REASONS,
        required: true
    },
    comment: {
        type: String,
        maxlength: 500,
        required: false
    },
    // Snapshot of the reported text at report time: the author can delete or
    // edit their content after being reported, the report must keep the wording.
    subjectText: {
        type: String,
        required: true,
        maxlength: 500
    },
    status: {
        type: String,
        enum: CONTENT_REPORT_STATUSES,
        default: "pending"
    }
}, {
    timestamps: true
});

// Anti-doublon: at most one report per (subject, reporter). Partial on purpose:
// public channel reports carry `reporter: null`, and a plain unique index would
// collapse every anonymous report of an item into a single row.
contentReportSchema.index(
    { subjectType: 1, subjectId: 1, reporter: 1 },
    { unique: true, partialFilterExpression: { reporter: { $type: "objectId" } } }
);
// Moderation queue: a trip's reports, newest first.
contentReportSchema.index({ trip: 1, createdAt: -1 });

export default mongoose.model("ContentReport", contentReportSchema);
