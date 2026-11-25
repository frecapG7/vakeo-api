import MessageReport from "../models/messageReportModel.mjs";
import { MESSAGE_REPORT_REASONS, reportMessage } from "./messageReportService.mjs";
import { InvalidError } from "../utils/errors.mjs";

describe("messageReportModel — schema", () => {
    test("schema has a reason path constrained to the reason whitelist", () => {
        const reasonPath = MessageReport.schema.path("reason");
        expect(reasonPath).toBeDefined();
        expect(reasonPath.options.required).toBe(true);
        expect(reasonPath.options.enum).toEqual(MESSAGE_REPORT_REASONS);
    });

    test("schema carries message, trip and reporter refs", () => {
        expect(MessageReport.schema.path("message").options.ref).toBe("Message");
        expect(MessageReport.schema.path("trip").options.ref).toBe("Trip");
        expect(MessageReport.schema.path("reporter").options.ref).toBe("TripUser");
    });

    test("comment is optional and capped at 500 characters", () => {
        const commentPath = MessageReport.schema.path("comment");
        expect(commentPath.options.required).toBeFalsy();
        expect(commentPath.options.maxlength).toBe(500);
    });

    test("messageText snapshot is required, status defaults to pending", () => {
        expect(MessageReport.schema.path("messageText").options.required).toBe(true);
        expect(MessageReport.schema.path("status").options.default).toBe("pending");
    });

    test("reporter is optional (public channel reports carry no identity)", () => {
        expect(MessageReport.schema.path("reporter").options.required).toBeFalsy();
    });

    test("one report per (message, reporter) is enforced by a partial unique index", () => {
        const indexes = MessageReport.schema.indexes();
        const unique = indexes.find(([, options]) => options?.unique);
        expect(unique).toBeDefined();
        expect(unique[0]).toEqual({ message: 1, reporter: 1 });
        // Partial, otherwise every anonymous report of a message (reporter: null)
        // would collide on a single row.
        expect(unique[1].partialFilterExpression).toEqual({ reporter: { $type: "objectId" } });
    });
});

describe("messageReportService — payload validation", () => {
    test("reason whitelist holds exactly the four client-facing motives", () => {
        expect(MESSAGE_REPORT_REASONS).toEqual(["spam", "harassment", "illicit", "other"]);
    });

    test("a reason outside the whitelist is rejected (422)", async () => {
        await expect(reportMessage("trip123", "msg1", "user1", { reason: "boring" }))
            .rejects.toThrow(InvalidError);
    });

    test("a missing reason is rejected (422)", async () => {
        await expect(reportMessage("trip123", "msg1", "user1", {}))
            .rejects.toThrow(InvalidError);
    });

    test("a non-string comment is rejected (422)", async () => {
        await expect(reportMessage("trip123", "msg1", "user1", { reason: "spam", comment: 42 }))
            .rejects.toThrow(InvalidError);
    });

    test("a comment longer than 500 characters is rejected (422)", async () => {
        await expect(reportMessage("trip123", "msg1", "user1", { reason: "spam", comment: "x".repeat(501) }))
            .rejects.toThrow(InvalidError);
    });

    test("validation happens before any DB access", async () => {
        // No DB connection in tests: reaching the model would hang or throw a
        // different error, so a clean 422 proves the early return.
        await expect(reportMessage("trip123", "msg1", "user1", { reason: "boring" }))
            .rejects.toBeInstanceOf(InvalidError);
    });
});

/**
 * Message lookup, self-report rejection, unique-index fallback and the
 * `reportedByMe` lookup are covered with mocked models in
 * messageReportService.flows.test.mjs; the same paths against a live MongoDB
 * are verified manually — see docs/v3-notes.md.
 */
