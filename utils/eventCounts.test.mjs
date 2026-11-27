import { buildEventCountIndex, readEventCounts } from "./eventCounts.mjs";

describe("buildEventCountIndex / readEventCounts", () => {
    test("merges message and good stats of the same event", () => {
        const index = buildEventCountIndex(
            [{ _id: "evt1", messageCount: 3, lastMessageAt: "2026-01-02T10:00:00.000Z" }],
            [{ _id: "evt1", total: 5, missing: 2 }]
        );

        expect(readEventCounts(index, "evt1")).toEqual({
            messageCount: 3,
            lastMessageAt: "2026-01-02T10:00:00.000Z",
            goodsCount: { total: 5, missing: 2 }
        });
    });

    test("keeps goods when the event has no message", () => {
        const index = buildEventCountIndex([], [{ _id: "evt1", total: 4, missing: 0 }]);

        const counts = readEventCounts(index, "evt1");
        expect(counts.messageCount).toBe(0);
        expect(counts.lastMessageAt).toBeNull();
        expect(counts.goodsCount).toEqual({ total: 4, missing: 0 });
    });

    test("keeps messages when the event has no good", () => {
        const index = buildEventCountIndex(
            [{ _id: "evt1", messageCount: 7, lastMessageAt: "2026-02-01T08:00:00.000Z" }],
            []
        );

        const counts = readEventCounts(index, "evt1");
        expect(counts.messageCount).toBe(7);
        expect(counts.goodsCount).toEqual({ total: 0, missing: 0 });
    });

    test("matches ObjectId-like ids through their string form", () => {
        const index = buildEventCountIndex(
            [{ _id: { toString: () => "evt1" }, messageCount: 2 }],
            []
        );

        expect(readEventCounts(index, { toString: () => "evt1" }).messageCount).toBe(2);
    });

    test("returns zeroed counts for an event without stats", () => {
        const index = buildEventCountIndex([], []);

        expect(readEventCounts(index, "evt1")).toEqual({
            messageCount: 0,
            lastMessageAt: null,
            goodsCount: { total: 0, missing: 0 }
        });
    });

    test("returns zeroed counts for the general channel (null event id)", () => {
        const index = buildEventCountIndex(
            [{ _id: "evt1", messageCount: 3 }],
            [{ _id: "evt1", total: 1, missing: 1 }]
        );

        expect(readEventCounts(index, null)).toEqual({
            messageCount: 0,
            lastMessageAt: null,
            goodsCount: { total: 0, missing: 0 }
        });
    });

    test("does not share count objects between events", () => {
        const index = buildEventCountIndex([], [{ _id: "evt1", total: 9, missing: 9 }]);

        const first = readEventCounts(index, "evt1");
        first.goodsCount.total = 0;

        expect(readEventCounts(index, "evt1").goodsCount.total).toBe(9);
        expect(readEventCounts(index, "evt2").goodsCount.total).toBe(0);
    });
});
