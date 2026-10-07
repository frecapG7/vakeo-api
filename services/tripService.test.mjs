import { jest } from "@jest/globals";

// --- Mocks: models and services with DB access ---
// batchHydrate touches Trip.find and getTripUsersByTokens. Visibility is
// enforced inside the trips query, so these tests lock the query contract.
// idEncoderService and validationService stay real (crypto + pure logic).
const mockTripFind = jest.fn();
const mockTripFindById = jest.fn();

jest.unstable_mockModule("../models/tripModel.mjs", () => ({
    default: { find: mockTripFind, findById: mockTripFindById },
}));

const mockTripUserService = {
    getTripUsersByTokens: jest.fn(),
};

jest.unstable_mockModule("./tripUserService.mjs", () => mockTripUserService);

const { encodeId } = await import("./idEncoderService.mjs");
const { batchHydrate, getTrip } = await import("./tripService.mjs");
const { InvalidError } = await import("../utils/errors.mjs");

beforeEach(() => {
    jest.clearAllMocks();
});

// Mongoose documents expose toObject(); batchHydrate spreads it into the response
const doc = (o) => ({ ...o, toObject: () => o });

describe("tripService", () => {

    test("module loads (smoke)", () => {
        expect(getTrip).toBeDefined();
        expect(batchHydrate).toBeDefined();
    });
});

describe("tripService.batchHydrate (validation — fail-closed)", () => {

    test("rejects empty or missing batch", async () => {
        await expect(batchHydrate(undefined)).rejects.toBeInstanceOf(InvalidError);
        await expect(batchHydrate([])).rejects.toBeInstanceOf(InvalidError);
    });

    test("rejects batch over 30 entries", async () => {
        const entries = Array.from({ length: 31 }, () => ({ id: "any" }));
        await expect(batchHydrate(entries)).rejects.toBeInstanceOf(InvalidError);
    });

    test("rejects entry without id", async () => {
        await expect(batchHydrate([{ token: "tok" }])).rejects.toBeInstanceOf(InvalidError);
    });

    test("rejects malformed encoded id", async () => {
        await expect(batchHydrate([{ id: "garbage" }])).rejects.toBeInstanceOf(InvalidError);
    });

    test("rejects duplicated ids", async () => {
        const encoded = encodeId("pub1");
        await expect(batchHydrate([{ id: encoded }, { id: encoded }])).rejects.toBeInstanceOf(InvalidError);
    });
});

describe("tripService.batchHydrate (visibility — enforced in the query)", () => {

    test("anonymous: query asks for public trips only", async () => {
        mockTripUserService.getTripUsersByTokens.mockResolvedValueOnce([]);
        mockTripFind.mockReturnValueOnce({
            populate: jest.fn().mockResolvedValue([
                doc({ _id: "pub1", name: "Public", isPrivate: false, users: ["m1"] }),
            ]),
        });

        const trips = await batchHydrate([{ id: encodeId("pub1") }, { id: encodeId("priv1") }]);
        expect(trips).toHaveLength(1);
        expect(trips[0].name).toBe("Public");

        const [query, projection] = mockTripFind.mock.calls[0];
        expect(query._id).toEqual({ $in: [expect.any(String), expect.any(String)] });
        expect(query.$or).toEqual([
            { isPrivate: { $ne: true } },
            { users: { $in: [] } },
        ]);
        expect(projection).toBe("users name image startDate endDate createdAt isPrivate");
    });

    test("member seat token: seat ids passed to the query, private trip returned", async () => {
        mockTripUserService.getTripUsersByTokens.mockResolvedValueOnce([
            { _id: "member1", token: "tok-alice" },
        ]);
        mockTripFind.mockReturnValueOnce({
            populate: jest.fn().mockResolvedValue([
                doc({ _id: "pub1", name: "Public", isPrivate: false, users: ["member1"] }),
                doc({ _id: "priv1", name: "Private", isPrivate: true, users: ["member1"] }),
            ]),
        });

        const trips = await batchHydrate([
            { id: encodeId("pub1") },
            { id: encodeId("priv1"), token: "tok-alice" },
        ]);
        expect(trips).toHaveLength(2);

        const query = mockTripFind.mock.calls[0][0];
        expect(query.$or[1]).toEqual({ users: { $in: ["member1"] } });
    });

    test("stale token: no seat, private trip excluded by the query", async () => {
        mockTripUserService.getTripUsersByTokens.mockResolvedValueOnce([]);
        mockTripFind.mockReturnValueOnce({
            populate: jest.fn().mockResolvedValue([]),
        });

        const trips = await batchHydrate([{ id: encodeId("priv1"), token: "stale" }]);
        expect(trips).toHaveLength(0);

        const query = mockTripFind.mock.calls[0][0];
        expect(query.$or[1]).toEqual({ users: { $in: [] } });
    });

    test("responds in batch order regardless of find order", async () => {
        mockTripUserService.getTripUsersByTokens.mockResolvedValueOnce([]);
        mockTripFind.mockReturnValueOnce({
            populate: jest.fn().mockResolvedValue([
                doc({ _id: "pub2", name: "Second", isPrivate: false, users: [] }),
                doc({ _id: "pub1", name: "First", isPrivate: false, users: [] }),
            ]),
        });

        const trips = await batchHydrate([{ id: encodeId("pub1") }, { id: encodeId("pub2") }]);
        expect(trips.map((t) => t.name)).toEqual(["First", "Second"]);
    });

    test("echoes the caller's encoded id on each returned trip", async () => {
        mockTripUserService.getTripUsersByTokens.mockResolvedValueOnce([]);
        mockTripFind.mockReturnValueOnce({
            populate: jest.fn().mockResolvedValue([
                doc({ _id: "pub1", name: "Public", isPrivate: false, users: [] }),
            ]),
        });

        const encoded = encodeId("pub1");
        const trips = await batchHydrate([{ id: encoded }]);
        expect(trips).toHaveLength(1);
        // Exact input string: encodeId uses a random IV, so re-encoding differs
        expect(trips[0].encodedId).toBe(encoded);
    });
});
