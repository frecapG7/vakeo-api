import { jest } from "@jest/globals";
import { ForbiddenError, InvalidError, NotFoundError } from "../utils/errors.mjs";

const mockMessage = {
    findOne: jest.fn(),
};

const mockMessageReport = {
    create: jest.fn(),
    findOne: jest.fn(),
    distinct: jest.fn(),
};

jest.unstable_mockModule("../models/messageModel.mjs", () => ({ default: mockMessage }));
jest.unstable_mockModule("../models/messageReportModel.mjs", () => ({
    default: mockMessageReport,
    MESSAGE_REPORT_REASONS: ["spam", "harassment", "illicit", "other"],
}));

const { reportMessage, reportMessageAnonymously, getReportedMessageIds } = await import("./messageReportService.mjs");

const MESSAGE_ID = "6511111111111111111111a1";

beforeEach(() => {
    jest.clearAllMocks();
});

describe("messageReportService — reportMessage", () => {
    test("stores the report with a snapshot of the message text", async () => {
        mockMessage.findOne.mockResolvedValueOnce({ _id: MESSAGE_ID, text: "idiot", user: "author1" });
        mockMessageReport.create.mockResolvedValueOnce({ _id: "report1", status: "pending" });

        const result = await reportMessage("trip123", MESSAGE_ID, "member1", { reason: "harassment" });

        expect(result).toEqual({ report: { _id: "report1", status: "pending" }, alreadyReported: false });
        expect(mockMessageReport.create).toHaveBeenCalledWith({
            message: MESSAGE_ID,
            trip: "trip123",
            reporter: "member1",
            reason: "harassment",
            comment: null,
            messageText: "idiot",
        });
    });

    test("trims the optional comment and blanks it when empty", async () => {
        mockMessage.findOne.mockResolvedValue({ _id: MESSAGE_ID, text: "spam", user: "author1" });
        mockMessageReport.create.mockResolvedValue({ _id: "report1" });

        await reportMessage("trip123", MESSAGE_ID, "member1", { reason: "spam", comment: "  abusif  " });
        expect(mockMessageReport.create.mock.calls[0][0].comment).toBe("abusif");

        await reportMessage("trip123", MESSAGE_ID, "member1", { reason: "spam", comment: "   " });
        expect(mockMessageReport.create.mock.calls[1][0].comment).toBeNull();
    });

    test("rejects reporting your own message (403)", async () => {
        mockMessage.findOne.mockResolvedValueOnce({ _id: MESSAGE_ID, text: "mine", user: "member1" });

        await expect(reportMessage("trip123", MESSAGE_ID, "member1", { reason: "spam" }))
            .rejects.toThrow(ForbiddenError);
        expect(mockMessageReport.create).not.toHaveBeenCalled();
    });

    test("unknown message in the trip surfaces 404", async () => {
        mockMessage.findOne.mockResolvedValueOnce(null);

        await expect(reportMessage("trip123", MESSAGE_ID, "member1", { reason: "spam" }))
            .rejects.toThrow(NotFoundError);
    });

    test("a malformed message id surfaces 404 without touching the DB", async () => {
        await expect(reportMessage("trip123", "not-an-object-id", "member1", { reason: "spam" }))
            .rejects.toThrow(NotFoundError);
        expect(mockMessage.findOne).not.toHaveBeenCalled();
    });

    test("a second report returns the existing one (unique index fallback)", async () => {
        mockMessage.findOne.mockResolvedValueOnce({ _id: MESSAGE_ID, text: "spam", user: "author1" });
        mockMessageReport.create.mockRejectedValueOnce(Object.assign(new Error("duplicate key"), { code: 11000 }));
        mockMessageReport.findOne.mockResolvedValueOnce({ _id: "report1", reason: "spam" });

        const result = await reportMessage("trip123", MESSAGE_ID, "member1", { reason: "spam" });

        expect(result.alreadyReported).toBe(true);
        expect(result.report).toEqual({ _id: "report1", reason: "spam" });
        expect(mockMessageReport.findOne).toHaveBeenCalledWith({ message: MESSAGE_ID, reporter: "member1" });
    });

    test("unexpected write errors are not swallowed", async () => {
        mockMessage.findOne.mockResolvedValueOnce({ _id: MESSAGE_ID, text: "spam", user: "author1" });
        mockMessageReport.create.mockRejectedValueOnce(new Error("write concern failed"));

        await expect(reportMessage("trip123", MESSAGE_ID, "member1", { reason: "spam" }))
            .rejects.toThrow("write concern failed");
    });
});

describe("messageReportService — getReportedMessageIds", () => {
    test("returns the reported ids of the caller as strings", async () => {
        mockMessageReport.distinct.mockResolvedValueOnce([MESSAGE_ID, "6511111111111111111111a2"]);

        const reported = await getReportedMessageIds("trip123", "member1", [MESSAGE_ID]);

        expect(reported.has(MESSAGE_ID)).toBe(true);
        expect(reported.has("6511111111111111111111a2")).toBe(true);
        expect(mockMessageReport.distinct).toHaveBeenCalledWith("message", {
            trip: "trip123",
            reporter: "member1",
            message: { $in: [MESSAGE_ID] },
        });
    });

    test("anonymous callers need no query", async () => {
        const reported = await getReportedMessageIds("trip123", null, [MESSAGE_ID]);

        expect(reported.size).toBe(0);
        expect(mockMessageReport.distinct).not.toHaveBeenCalled();
    });

    test("an empty page needs no query", async () => {
        const reported = await getReportedMessageIds("trip123", "member1", []);

        expect(reported.size).toBe(0);
        expect(mockMessageReport.distinct).not.toHaveBeenCalled();
    });
});

describe("messageReportService — reportMessageAnonymously (public channel)", () => {
    test("stores an anonymous report, deriving the trip from the message", async () => {
        mockMessage.findOne.mockResolvedValueOnce({ _id: MESSAGE_ID, text: "insulte", trip: "trip123" });
        mockMessageReport.create.mockResolvedValueOnce({ _id: "report1" });

        const result = await reportMessageAnonymously(MESSAGE_ID, { reason: "illicit" });

        expect(result).toEqual({ received: true });
        expect(mockMessageReport.create).toHaveBeenCalledWith({
            message: MESSAGE_ID,
            trip: "trip123",
            reporter: null,
            reason: "illicit",
            comment: null,
            messageText: "insulte",
        });
    });

    test("an unknown message is accepted silently — no existence oracle", async () => {
        mockMessage.findOne.mockResolvedValueOnce(null);

        await expect(reportMessageAnonymously(MESSAGE_ID, { reason: "spam" }))
            .resolves.toEqual({ received: true });
        expect(mockMessageReport.create).not.toHaveBeenCalled();
    });

    test("a malformed message id is accepted silently, without a DB query", async () => {
        await expect(reportMessageAnonymously("not-an-object-id", { reason: "spam" }))
            .resolves.toEqual({ received: true });
        expect(mockMessage.findOne).not.toHaveBeenCalled();
    });

    test("an invalid reason is still refused before any DB access (422)", async () => {
        await expect(reportMessageAnonymously(MESSAGE_ID, { reason: "boring" }))
            .rejects.toThrow(InvalidError);
        expect(mockMessage.findOne).not.toHaveBeenCalled();
    });

    test("the optional comment goes through the same normalization", async () => {
        mockMessage.findOne.mockResolvedValue({ _id: MESSAGE_ID, text: "spam", trip: "trip123" });
        mockMessageReport.create.mockResolvedValue({ _id: "report1" });

        await reportMessageAnonymously(MESSAGE_ID, { reason: "spam", comment: "  a l'ecran  " });
        expect(mockMessageReport.create.mock.calls[0][0].comment).toBe("a l'ecran");
    });
});
