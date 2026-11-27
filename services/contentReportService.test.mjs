import ContentReport from "../models/contentReportModel.mjs";
import {
    CONTENT_REPORT_REASONS,
    CONTENT_REPORT_SUBJECTS,
    reportContent,
    reportContentAnonymously
} from "./contentReportService.mjs";
import { InvalidError } from "../utils/errors.mjs";

describe("contentReportModel — schema", () => {
    test("schema has a subjectType path constrained to the subject whitelist", () => {
        const subjectTypePath = ContentReport.schema.path("subjectType");
        expect(subjectTypePath).toBeDefined();
        expect(subjectTypePath.options.required).toBe(true);
        expect(subjectTypePath.options.enum).toEqual(CONTENT_REPORT_SUBJECTS);
    });

    test("schema carries a polymorphic subjectId and a denormalised trip", () => {
        expect(ContentReport.schema.path("subjectId").options.required).toBe(true);
        expect(ContentReport.schema.path("trip").options.ref).toBe("Trip");
        expect(ContentReport.schema.path("reporter").options.ref).toBe("TripUser");
    });

    test("reporter is optional (public channel reports carry no identity)", () => {
        expect(ContentReport.schema.path("reporter").options.required).toBeFalsy();
    });

    test("reason is constrained to the reason whitelist", () => {
        expect(ContentReport.schema.path("reason").options.enum).toEqual(CONTENT_REPORT_REASONS);
    });

    test("comment is optional and capped at 500 characters", () => {
        const commentPath = ContentReport.schema.path("comment");
        expect(commentPath.options.required).toBeFalsy();
        expect(commentPath.options.maxlength).toBe(500);
    });

    test("subjectText snapshot is required and capped like a comment", () => {
        expect(ContentReport.schema.path("subjectText").options.required).toBe(true);
        expect(ContentReport.schema.path("subjectText").options.maxlength).toBe(500);
    });

    test("status defaults to pending", () => {
        expect(ContentReport.schema.path("status").options.default).toBe("pending");
    });

    test("one report per (subject, reporter) is enforced by a partial unique index", () => {
        const indexes = ContentReport.schema.indexes();
        const unique = indexes.find(([, options]) => options?.unique);
        expect(unique).toBeDefined();
        expect(unique[0]).toEqual({ subjectType: 1, subjectId: 1, reporter: 1 });
        // Partial, otherwise every anonymous report of an item (reporter: null)
        // would collide on a single row.
        expect(unique[1].partialFilterExpression).toEqual({ reporter: { $type: "objectId" } });
    });
});

describe("contentReportService — payload validation", () => {
    test("subject whitelist covers every user-generated content type of a trip", () => {
        expect(CONTENT_REPORT_SUBJECTS).toEqual([
            "message", "event", "trip", "tripUser", "tripStop", "poll", "link", "good"
        ]);
    });

    test("reason whitelist holds exactly the four client-facing motives", () => {
        expect(CONTENT_REPORT_REASONS).toEqual(["spam", "harassment", "illicit", "other"]);
    });

    test("an unknown subject type is rejected (422)", async () => {
        await expect(reportContent("trip123", "user1", { subjectType: "wallet", subjectId: "6511111111111111111111a1", reason: "spam" }))
            .rejects.toThrow(InvalidError);
        await expect(reportContentAnonymously({ subjectType: "wallet", subjectId: "6511111111111111111111a1", reason: "spam" }))
            .rejects.toThrow(InvalidError);
    });

    test("a reason outside the whitelist is rejected (422)", async () => {
        await expect(reportContent("trip123", "user1", { subjectType: "message", subjectId: "6511111111111111111111a1", reason: "boring" }))
            .rejects.toThrow(InvalidError);
    });

    test("a missing reason is rejected (422)", async () => {
        await expect(reportContent("trip123", "user1", { subjectType: "message", subjectId: "6511111111111111111111a1" }))
            .rejects.toThrow(InvalidError);
    });

    test("a non-string comment is rejected (422)", async () => {
        await expect(reportContent("trip123", "user1", { subjectType: "message", subjectId: "6511111111111111111111a1", reason: "spam", comment: 42 }))
            .rejects.toThrow(InvalidError);
    });

    test("a comment longer than 500 characters is rejected (422)", async () => {
        await expect(reportContent("trip123", "user1", { subjectType: "message", subjectId: "6511111111111111111111a1", reason: "spam", comment: "x".repeat(501) }))
            .rejects.toThrow(InvalidError);
    });

    test("validation happens before any DB access", async () => {
        // No DB connection in tests: reaching a model would hang or throw a
        // different error, so a clean 422 proves the early return.
        await expect(reportContent("trip123", "user1", { subjectType: "event", subjectId: "6511111111111111111111a1", reason: "boring" }))
            .rejects.toBeInstanceOf(InvalidError);
    });
});

/**
 * Subject resolution, self-report rejection, unique-index fallback and the
 * `reportedByMe` lookup are covered with mocked models in
 * contentReportService.flows.test.mjs; the same paths against a live MongoDB
 * are verified manually — see docs/v3-notes.md.
 */
