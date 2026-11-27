import { jest } from "@jest/globals";
import { ForbiddenError, InvalidError, NotFoundError } from "../utils/errors.mjs";

const SUBJECT_ID = "6511111111111111111111a1";
const OTHER_ID = "6511111111111111111111a2";
const TRIP_ID = "6511111111111111111111b1";
const MEMBER_ID = "6511111111111111111111c1";

const mockMessage = { findOne: jest.fn() };
const mockEvent = { findOne: jest.fn() };
const mockTrip = { findOne: jest.fn(), exists: jest.fn() };
const mockTripUser = { findOne: jest.fn() };
const mockTripStop = { findOne: jest.fn() };
const mockPoll = { findOne: jest.fn() };
const mockLink = { findOne: jest.fn() };
const mockGood = { findOne: jest.fn() };
const mockContentReport = { create: jest.fn(), findOne: jest.fn(), distinct: jest.fn() };

jest.unstable_mockModule("../models/messageModel.mjs", () => ({ default: mockMessage }));
jest.unstable_mockModule("../models/eventModel.mjs", () => ({ default: mockEvent }));
jest.unstable_mockModule("../models/tripModel.mjs", () => ({ default: mockTrip }));
jest.unstable_mockModule("../models/tripUserModel.mjs", () => ({ default: mockTripUser }));
jest.unstable_mockModule("../models/tripStopModel.mjs", () => ({ default: mockTripStop }));
jest.unstable_mockModule("../models/pollModel.mjs", () => ({ default: mockPoll, Poll: mockPoll }));
jest.unstable_mockModule("../models/linkModel.mjs", () => ({ default: mockLink }));
jest.unstable_mockModule("../models/goodModel.mjs", () => ({ default: mockGood }));
jest.unstable_mockModule("../models/contentReportModel.mjs", () => ({
    default: mockContentReport,
    CONTENT_REPORT_REASONS: ["spam", "harassment", "illicit", "other"],
    CONTENT_REPORT_SUBJECTS: ["message", "event", "trip", "tripUser", "tripStop", "poll", "link", "good"],
}));

const { reportContent, reportContentAnonymously, getReportedSubjectIds } = await import("./contentReportService.mjs");

beforeEach(() => {
    jest.clearAllMocks();
});

describe("contentReportService — seat channel", () => {
    test("stores a message report inside the trip, with a text snapshot", async () => {
        mockMessage.findOne.mockResolvedValueOnce({ _id: SUBJECT_ID, text: "idiot", user: "author1" });
        mockContentReport.create.mockResolvedValueOnce({ _id: "report1", status: "pending" });

        const result = await reportContent("trip123", "member1", {
            subjectType: "message",
            subjectId: SUBJECT_ID,
            reason: "harassment",
        });

        expect(result).toEqual({ report: { _id: "report1", status: "pending" }, alreadyReported: false });
        expect(mockMessage.findOne).toHaveBeenCalledWith({ _id: SUBJECT_ID, trip: "trip123" }, "text user");
        expect(mockContentReport.create).toHaveBeenCalledWith({
            subjectType: "message",
            subjectId: SUBJECT_ID,
            trip: "trip123",
            reporter: "member1",
            reason: "harassment",
            comment: null,
            subjectText: "idiot",
        });
    });

    test("trims the optional comment and blanks it when empty", async () => {
        mockMessage.findOne.mockResolvedValue({ _id: SUBJECT_ID, text: "spam", user: "author1" });
        mockContentReport.create.mockResolvedValue({ _id: "report1" });

        await reportContent("trip123", "member1", { subjectType: "message", subjectId: SUBJECT_ID, reason: "spam", comment: "  abusif  " });
        expect(mockContentReport.create.mock.calls[0][0].comment).toBe("abusif");

        await reportContent("trip123", "member1", { subjectType: "message", subjectId: SUBJECT_ID, reason: "spam", comment: "   " });
        expect(mockContentReport.create.mock.calls[1][0].comment).toBeNull();
    });

    test("rejects reporting a message you wrote (403)", async () => {
        mockMessage.findOne.mockResolvedValueOnce({ _id: SUBJECT_ID, text: "mine", user: "member1" });

        await expect(reportContent("trip123", "member1", { subjectType: "message", subjectId: SUBJECT_ID, reason: "spam" }))
            .rejects.toThrow(ForbiddenError);
        expect(mockContentReport.create).not.toHaveBeenCalled();
    });

    test("an event report snapshots name and details, and catches owner self-report", async () => {
        mockEvent.findOne.mockResolvedValueOnce({ _id: SUBJECT_ID, name: "Soiree", details: "adresse secrete", owners: ["author1", "member1"] });

        await expect(reportContent("trip123", "member1", { subjectType: "event", subjectId: SUBJECT_ID, reason: "other" }))
            .rejects.toThrow(ForbiddenError);

        mockEvent.findOne.mockResolvedValueOnce({ _id: SUBJECT_ID, name: "Soiree", details: "adresse secrete", owners: ["author1"] });
        mockContentReport.create.mockResolvedValueOnce({ _id: "report2" });

        await reportContent("trip123", "member1", { subjectType: "event", subjectId: SUBJECT_ID, reason: "other" });
        expect(mockContentReport.create.mock.calls[0][0].subjectText).toBe("Soiree · adresse secrete");
    });

    test("a poll is reportable and its creator cannot report it (403)", async () => {
        mockPoll.findOne.mockResolvedValueOnce({ _id: SUBJECT_ID, question: "Qui vient ?", createdBy: "member1" });

        await expect(reportContent("trip123", "member1", { subjectType: "poll", subjectId: SUBJECT_ID, reason: "spam" }))
            .rejects.toThrow(ForbiddenError);
    });

    test("the trip itself is a reportable subject, scoped to the route trip", async () => {
        mockTrip.findOne.mockResolvedValueOnce({ _id: TRIP_ID, name: "Bali", description: "aller simple" });
        mockContentReport.create.mockResolvedValueOnce({ _id: "report1" });

        await reportContent(TRIP_ID, "member1", { subjectType: "trip", subjectId: TRIP_ID, reason: "illicit" });
        expect(mockContentReport.create.mock.calls[0][0]).toMatchObject({
            subjectType: "trip",
            trip: TRIP_ID,
            subjectText: "Bali · aller simple",
        });

        mockTrip.findOne.mockResolvedValueOnce({ _id: OTHER_ID, name: "Rome", description: null });
        await expect(reportContent(TRIP_ID, "member1", { subjectType: "trip", subjectId: OTHER_ID, reason: "illicit" }))
            .rejects.toThrow(NotFoundError);
    });

    test("a seat is only reportable inside the trip that owns it", async () => {
        mockTrip.exists.mockResolvedValueOnce(0);
        await expect(reportContent("trip123", "member1", { subjectType: "tripUser", subjectId: OTHER_ID, reason: "harassment" }))
            .rejects.toThrow(NotFoundError);

        mockTrip.exists.mockResolvedValueOnce(1);
        mockTripUser.findOne.mockResolvedValueOnce({ _id: OTHER_ID, name: "Bob" });
        mockContentReport.create.mockResolvedValueOnce({ _id: "report1" });

        await reportContent("trip123", "member1", { subjectType: "tripUser", subjectId: OTHER_ID, reason: "harassment" });
        expect(mockContentReport.create.mock.calls[0][0]).toMatchObject({ subjectText: "Bob", trip: "trip123" });
    });

    test("reporting your own seat is refused (403)", async () => {
        mockTrip.exists.mockResolvedValueOnce(1);
        mockTripUser.findOne.mockResolvedValueOnce({ _id: MEMBER_ID, name: "Alice" });

        await expect(reportContent("trip123", MEMBER_ID, { subjectType: "tripUser", subjectId: MEMBER_ID, reason: "spam" }))
            .rejects.toThrow(ForbiddenError);
    });

    test("a long subject text is capped at 500 characters", async () => {
        mockTrip.findOne.mockResolvedValueOnce({ _id: TRIP_ID, name: "Bali", description: "x".repeat(500) });
        mockContentReport.create.mockResolvedValueOnce({ _id: "report1" });

        await reportContent(TRIP_ID, "member1", { subjectType: "trip", subjectId: TRIP_ID, reason: "spam" });
        expect(mockContentReport.create.mock.calls[0][0].subjectText).toHaveLength(500);
    });

    test("the cap also applies to extractors that read a raw field", async () => {
        // A poll question is bounded by its own maxlength, but the snapshot must
        // not depend on that holding (or on legacy documents honouring it).
        mockPoll.findOne.mockResolvedValueOnce({ _id: SUBJECT_ID, question: "?".repeat(600), createdBy: "author1" });
        mockContentReport.create.mockResolvedValueOnce({ _id: "report1" });

        await reportContent("trip123", "member1", { subjectType: "poll", subjectId: SUBJECT_ID, reason: "spam" });
        expect(mockContentReport.create.mock.calls[0][0].subjectText).toHaveLength(500);
    });

    test("a duplicate whose conflicting row vanished is retried, not returned as null", async () => {
        mockMessage.findOne.mockResolvedValueOnce({ _id: SUBJECT_ID, text: "spam", user: "author1" });
        mockContentReport.create.mockRejectedValueOnce(Object.assign(new Error("duplicate key"), { code: 11000 }));
        mockContentReport.findOne.mockResolvedValueOnce(null);
        mockContentReport.create.mockResolvedValueOnce({ _id: "report2", reason: "spam" });

        const result = await reportContent("trip123", "member1", { subjectType: "message", subjectId: SUBJECT_ID, reason: "spam" });

        expect(result).toEqual({ report: { _id: "report2", reason: "spam" }, alreadyReported: false });
        expect(mockContentReport.create).toHaveBeenCalledTimes(2);
    });

    test("a retry that hits the duplicate again surfaces the error, never a fake success", async () => {
        mockMessage.findOne.mockResolvedValueOnce({ _id: SUBJECT_ID, text: "spam", user: "author1" });
        mockContentReport.create.mockRejectedValueOnce(Object.assign(new Error("duplicate key"), { code: 11000 }));
        mockContentReport.findOne.mockResolvedValueOnce(null);
        mockContentReport.create.mockRejectedValueOnce(Object.assign(new Error("duplicate key"), { code: 11000 }));

        await expect(reportContent("trip123", "member1", { subjectType: "message", subjectId: SUBJECT_ID, reason: "spam" }))
            .rejects.toThrow("duplicate key");
    });

    test("unknown subject surfaces 404", async () => {
        mockMessage.findOne.mockResolvedValueOnce(null);

        await expect(reportContent("trip123", "member1", { subjectType: "message", subjectId: SUBJECT_ID, reason: "spam" }))
            .rejects.toThrow(NotFoundError);
    });

    test("a malformed subject id surfaces 404 without touching the DB", async () => {
        await expect(reportContent("trip123", "member1", { subjectType: "message", subjectId: "not-an-id", reason: "spam" }))
            .rejects.toThrow(NotFoundError);
        expect(mockMessage.findOne).not.toHaveBeenCalled();
    });

    test("a non-string subject id surfaces 404 without touching the DB", async () => {
        // A JSON body can carry 123, true or an object: the string guard keeps
        // the CastError (500) out of reach, whatever bson's isValid() accepts.
        for (const subjectId of [123, true, { $ne: null }]) {
            await expect(reportContent("trip123", "member1", { subjectType: "message", subjectId, reason: "spam" }))
                .rejects.toThrow(NotFoundError);
        }
        expect(mockMessage.findOne).not.toHaveBeenCalled();
    });

    test("a second report returns the existing one (unique index fallback)", async () => {
        mockMessage.findOne.mockResolvedValueOnce({ _id: SUBJECT_ID, text: "spam", user: "author1" });
        mockContentReport.create.mockRejectedValueOnce(Object.assign(new Error("duplicate key"), { code: 11000 }));
        mockContentReport.findOne.mockResolvedValueOnce({ _id: "report1", reason: "spam" });

        const result = await reportContent("trip123", "member1", { subjectType: "message", subjectId: SUBJECT_ID, reason: "spam" });

        expect(result.alreadyReported).toBe(true);
        expect(result.report).toEqual({ _id: "report1", reason: "spam" });
        expect(mockContentReport.findOne).toHaveBeenCalledWith({ subjectType: "message", subjectId: SUBJECT_ID, reporter: "member1" });
    });

    test("unexpected write errors are not swallowed", async () => {
        mockMessage.findOne.mockResolvedValueOnce({ _id: SUBJECT_ID, text: "spam", user: "author1" });
        mockContentReport.create.mockRejectedValueOnce(new Error("write concern failed"));

        await expect(reportContent("trip123", "member1", { subjectType: "message", subjectId: SUBJECT_ID, reason: "spam" }))
            .rejects.toThrow("write concern failed");
    });
});

describe("contentReportService — public channel", () => {
    test("stores an anonymous report, deriving the trip from the subject", async () => {
        mockMessage.findOne.mockResolvedValueOnce({ _id: SUBJECT_ID, text: "insulte", trip: "trip123" });
        mockContentReport.create.mockResolvedValueOnce({ _id: "report1" });

        const result = await reportContentAnonymously({ subjectType: "message", subjectId: SUBJECT_ID, reason: "illicit" });

        expect(result).toEqual({ received: true });
        // No trip context on this channel: the subject is located by id only.
        expect(mockMessage.findOne).toHaveBeenCalledWith({ _id: SUBJECT_ID }, "text user");
        expect(mockContentReport.create).toHaveBeenCalledWith({
            subjectType: "message",
            subjectId: SUBJECT_ID,
            trip: "trip123",
            reporter: null,
            reason: "illicit",
            comment: null,
            subjectText: "insulte",
        });
    });

    test("an unknown subject is accepted silently — no existence oracle", async () => {
        mockGood.findOne.mockResolvedValueOnce(null);

        await expect(reportContentAnonymously({ subjectType: "good", subjectId: SUBJECT_ID, reason: "spam" }))
            .resolves.toEqual({ received: true });
        expect(mockContentReport.create).not.toHaveBeenCalled();
    });

    test("a malformed subject id is accepted silently, without a DB query", async () => {
        await expect(reportContentAnonymously({ subjectType: "message", subjectId: "not-an-id", reason: "spam" }))
            .resolves.toEqual({ received: true });
        expect(mockMessage.findOne).not.toHaveBeenCalled();
    });

    test("a non-string subject id stays a uniform 202, without a DB query", async () => {
        for (const subjectId of [123, true, { $ne: null }]) {
            await expect(reportContentAnonymously({ subjectType: "message", subjectId, reason: "spam" }))
                .resolves.toEqual({ received: true });
        }
        expect(mockMessage.findOne).not.toHaveBeenCalled();
        expect(mockContentReport.create).not.toHaveBeenCalled();
    });

    test("a seat cannot be resolved without a trip context: silently dropped", async () => {
        // TripUser carries no trip ref, so the anonymous channel cannot scope it.
        await expect(reportContentAnonymously({ subjectType: "tripUser", subjectId: OTHER_ID, reason: "harassment" }))
            .resolves.toEqual({ received: true });
        expect(mockTripUser.findOne).not.toHaveBeenCalled();
        expect(mockContentReport.create).not.toHaveBeenCalled();
    });

    test("the trip itself is resolvable without a trip context", async () => {
        mockTrip.findOne.mockResolvedValueOnce({ _id: TRIP_ID, name: "Bali", description: null });
        mockContentReport.create.mockResolvedValueOnce({ _id: "report1" });

        await reportContentAnonymously({ subjectType: "trip", subjectId: TRIP_ID, reason: "illicit" });
        expect(mockContentReport.create.mock.calls[0][0]).toMatchObject({ trip: TRIP_ID, reporter: null });
    });

    test("an invalid reason is still refused before any DB access (422)", async () => {
        await expect(reportContentAnonymously({ subjectType: "message", subjectId: SUBJECT_ID, reason: "boring" }))
            .rejects.toThrow(InvalidError);
        expect(mockMessage.findOne).not.toHaveBeenCalled();
    });

    test("the optional comment goes through the same normalization", async () => {
        mockMessage.findOne.mockResolvedValue({ _id: SUBJECT_ID, text: "spam", trip: "trip123" });
        mockContentReport.create.mockResolvedValue({ _id: "report1" });

        await reportContentAnonymously({ subjectType: "message", subjectId: SUBJECT_ID, reason: "spam", comment: "  a l'ecran  " });
        expect(mockContentReport.create.mock.calls[0][0].comment).toBe("a l'ecran");
    });
});

describe("contentReportService — getReportedSubjectIds", () => {
    test("returns the reported ids of the caller for one subject type", async () => {
        mockContentReport.distinct.mockResolvedValueOnce([SUBJECT_ID, OTHER_ID]);

        const reported = await getReportedSubjectIds("trip123", "member1", "message", [SUBJECT_ID]);

        expect(reported.has(SUBJECT_ID)).toBe(true);
        expect(mockContentReport.distinct).toHaveBeenCalledWith("subjectId", {
            trip: "trip123",
            subjectType: "message",
            reporter: "member1",
            subjectId: { $in: [SUBJECT_ID] },
        });
    });

    test("anonymous callers need no query", async () => {
        const reported = await getReportedSubjectIds("trip123", null, "message", [SUBJECT_ID]);

        expect(reported.size).toBe(0);
        expect(mockContentReport.distinct).not.toHaveBeenCalled();
    });

    test("an empty page needs no query", async () => {
        const reported = await getReportedSubjectIds("trip123", "member1", "message", []);

        expect(reported.size).toBe(0);
        expect(mockContentReport.distinct).not.toHaveBeenCalled();
    });
});
