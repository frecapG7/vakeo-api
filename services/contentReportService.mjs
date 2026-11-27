import mongoose from "mongoose";
import Message from "../models/messageModel.mjs";
import Event from "../models/eventModel.mjs";
import Trip from "../models/tripModel.mjs";
import TripUser from "../models/tripUserModel.mjs";
import TripStop from "../models/tripStopModel.mjs";
import { Poll } from "../models/pollModel.mjs";
import Link from "../models/linkModel.mjs";
import Good from "../models/goodModel.mjs";
import ContentReport, {
    CONTENT_REPORT_REASONS,
    CONTENT_REPORT_SUBJECTS
} from "../models/contentReportModel.mjs";
import { ForbiddenError, InvalidError, NotFoundError } from "../utils/errors.mjs";

export { CONTENT_REPORT_REASONS, CONTENT_REPORT_SUBJECTS };

const COMMENT_MAX_LENGTH = 500;
const SUBJECT_TEXT_MAX_LENGTH = 500;

/**
 * Per-subject resolution rules. `text` snapshots what was reported, `owners`
 * feeds the self-report rejection (empty when the model carries no creator).
 * `tripScoped` = the document has a `trip` field, so it can be located from the
 * public channel without a trip context.
 */
const SUBJECTS = {
    message: {
        model: Message,
        projection: "text user",
        tripScoped: true,
        text: (doc) => doc.text,
        owners: (doc) => [doc.user]
    },
    event: {
        model: Event,
        projection: "name details owners",
        tripScoped: true,
        text: (doc) => joinText(doc.name, doc.details),
        owners: (doc) => doc.owners ?? []
    },
    trip: {
        model: Trip,
        projection: "name description",
        tripScoped: false,
        text: (doc) => joinText(doc.name, doc.description),
        owners: () => []
    },
    tripUser: {
        model: TripUser,
        projection: "name",
        tripScoped: false,
        text: (doc) => doc.name,
        owners: (doc) => [doc._id]
    },
    tripStop: {
        model: TripStop,
        projection: "name createdBy",
        tripScoped: true,
        text: (doc) => doc.name,
        owners: (doc) => [doc.createdBy]
    },
    poll: {
        model: Poll,
        projection: "question createdBy",
        tripScoped: true,
        text: (doc) => doc.question,
        owners: (doc) => [doc.createdBy]
    },
    link: {
        model: Link,
        projection: "title url",
        tripScoped: true,
        text: (doc) => joinText(doc.title, doc.url),
        owners: () => []
    },
    good: {
        model: Good,
        projection: "name createdBy",
        tripScoped: true,
        text: (doc) => doc.name,
        owners: (doc) => [doc.createdBy]
    }
};

function joinText(...parts) {
    return parts.filter(Boolean).join(" · ").slice(0, SUBJECT_TEXT_MAX_LENGTH);
}

const assertValidSubjectType = (subjectType) => {
    if (!CONTENT_REPORT_SUBJECTS.includes(subjectType))
        throw new InvalidError(`subjectType must be one of: ${CONTENT_REPORT_SUBJECTS.join(", ")}`);
};

const assertValidReason = (reason) => {
    if (!CONTENT_REPORT_REASONS.includes(reason))
        throw new InvalidError(`Reason must be one of: ${CONTENT_REPORT_REASONS.join(", ")}`);
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
 * Loads the reported document, enforcing the trip scope when a trip context is
 * known (seat channel). Returns null when the subject does not exist inside the
 * trip — the caller decides whether that is a 404 or a silent drop.
 * @returns {Promise<{ doc: object, trip: any, subjectText: string, owners: any[] } | null>}
 */
const loadSubject = async (subjectType, subjectId, tripId = null) => {
    const subject = SUBJECTS[subjectType];

    if (subjectType === "trip") {
        // The reported item is the trip itself: no `trip` field to match on.
        const trip = await subject.model.findOne({ _id: subjectId }, subject.projection);
        if (!trip)
            return null;
        if (tripId && String(trip._id) !== String(tripId))
            return null;
        return { doc: trip, trip: trip._id, subjectText: subject.text(trip), owners: subject.owners(trip) };
    }

    if (subjectType === "tripUser") {
        // A seat carries no trip ref (see docs/v3-notes.md): without a trip
        // context there is no way to scope it, so the public channel cannot
        // resolve this subject type.
        if (!tripId)
            return null;
        if (!(await Trip.exists({ _id: tripId, users: subjectId })))
            return null;
        const seat = await subject.model.findOne({ _id: subjectId }, subject.projection);
        if (!seat)
            return null;
        return { doc: seat, trip: tripId, subjectText: subject.text(seat), owners: subject.owners(seat) };
    }

    const filter = { _id: subjectId, ...(tripId ? { trip: tripId } : {}) };
    const doc = await subject.model.findOne(filter, subject.projection);
    if (!doc)
        return null;
    return { doc, trip: tripId ?? doc.trip, subjectText: subject.text(doc), owners: subject.owners(doc) };
};

const buildReport = ({ subjectType, subjectId, trip, reporter, reason, comment, subjectText }) => ({
    subjectType,
    subjectId,
    trip,
    reporter,
    reason,
    comment,
    subjectText
});

/**
 * Seat channel: a trip member reports one item of the trip.
 * Idempotent per (subject, reporter): a second report returns the existing one
 * with `alreadyReported: true` instead of throwing, so the client can settle its
 * "already reported" state without an error path.
 * @returns {Promise<{ report: object, alreadyReported: boolean }>}
 */
export const reportContent = async (tripId, reporterId, { subjectType, subjectId, reason, comment } = {}) => {
    assertValidSubjectType(subjectType);
    assertValidReason(reason);
    const normalizedComment = normalizeComment(comment);

    if (!mongoose.Types.ObjectId.isValid(subjectId))
        throw new NotFoundError(`${subjectType} ${subjectId} not found`);

    const subject = await loadSubject(subjectType, subjectId, tripId);
    if (!subject)
        throw new NotFoundError(`${subjectType} ${subjectId} not found`);
    if (subject.owners.some((owner) => String(owner) === String(reporterId)))
        throw new ForbiddenError("You cannot report your own content");

    try {
        const report = await ContentReport.create(buildReport({
            subjectType,
            subjectId: subject.doc._id,
            trip: subject.trip,
            reporter: reporterId,
            reason,
            comment: normalizedComment,
            subjectText: subject.subjectText
        }));
        return { report, alreadyReported: false };
    } catch (error) {
        if (error?.code !== 11000)
            throw error;
        // Unique (subject, reporter) index tripped: the report already exists.
        const existing = await ContentReport.findOne({ subjectType, subjectId: subject.doc._id, reporter: reporterId });
        return { report: existing, alreadyReported: true };
    }
};

/**
 * Public channel — no seat required (DSA art. 16: any individual or entity must
 * be able to notify illegal content). No identity is stored, so no anti-doublon
 * is possible either: several anonymous reports of one item stay separate rows,
 * and they are triage signals that never justify a decision on their own.
 *
 * The outcome is deliberately uniform — `{ received: true }` for an unknown,
 * malformed or unscopable subject as well, so the endpoint is not an existence
 * oracle.
 * @returns {Promise<{ received: true }>}
 */
export const reportContentAnonymously = async ({ subjectType, subjectId, reason, comment } = {}) => {
    assertValidSubjectType(subjectType);
    assertValidReason(reason);
    const normalizedComment = normalizeComment(comment);

    if (!mongoose.Types.ObjectId.isValid(subjectId))
        return { received: true };

    const subject = await loadSubject(subjectType, subjectId);
    if (!subject)
        return { received: true };

    await ContentReport.create(buildReport({
        subjectType,
        subjectId: subject.doc._id,
        trip: subject.trip,
        reporter: null,
        reason,
        comment: normalizedComment,
        subjectText: subject.subjectText
    }));
    return { received: true };
};

/**
 * Ids, among `subjectIds`, that `reporterId` already reported in this trip for
 * that subject type. Backs the `reportedByMe` flag of the message lists. One
 * indexed query per listing; no-op for anonymous callers.
 * @returns {Promise<Set<string>>}
 */
export const getReportedSubjectIds = async (tripId, reporterId, subjectType, subjectIds = []) => {
    if (!reporterId || subjectIds.length === 0)
        return new Set();

    const ids = await ContentReport.distinct("subjectId", {
        trip: tripId,
        subjectType,
        reporter: reporterId,
        subjectId: { $in: subjectIds }
    });
    return new Set(ids.map(String));
};
