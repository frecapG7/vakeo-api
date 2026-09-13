import { jest } from "@jest/globals";

// --- Mock the DB-dependent services ---
const mockTripService = {
    getTrip: jest.fn(),
};

const mockTripUserService = {
    getTripUserWithToken: jest.fn(),
    claimSeat: jest.fn(),
};

jest.unstable_mockModule("../../services/tripService.mjs", () => mockTripService);
jest.unstable_mockModule("../../services/tripUserService.mjs", () => mockTripUserService);

// --- Build the test app ---
const { encodeId, decodeId } = await import("../../services/idEncoderService.mjs");

let app, server, baseUrl;

const TRIP_ID = "507f1f77bcf86cd799439011";
const USER_ID = "507f1f77bcf86cd799439022";
const STRANGER_ID = "507f1f77bcf86cd799439033";

beforeAll(async () => {
    const express = (await import("express")).default;
    const { handleError } = await import("../../middlewares/errorMiddleware.mjs");
    const migrateRouter = (await import("./migrate.mjs")).default;

    app = express();
    app.use(express.json());
    app.use("/migrate", migrateRouter);
    app.use(handleError);

    server = app.listen(0);
    baseUrl = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
    await new Promise((r) => server.close(r));
});

const fakeTrip = (overrides = {}) => ({
    _id: TRIP_ID,
    name: "Summer",
    users: [USER_ID],
    isPrivate: false,
    ...overrides,
});


describe("POST /migrate", () => {

    test("returns encodedId only when no x-user-id", async () => {
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());

        const res = await fetch(`${baseUrl}/migrate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tripId: TRIP_ID }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(decodeId(body.encodedId)).toBe(TRIP_ID);
        expect(body.user).toBeUndefined();
        expect(body.token).toBeUndefined();
    });

    test("mints a token for a legacy user with a free seat", async () => {
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());
        mockTripUserService.claimSeat.mockResolvedValueOnce({
            _id: USER_ID, name: "Alice", token: "new-token-123",
        });

        const res = await fetch(`${baseUrl}/migrate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": USER_ID },
            body: JSON.stringify({ tripId: TRIP_ID }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(decodeId(body.encodedId)).toBe(TRIP_ID);
        expect(body.user).toEqual({ _id: USER_ID, name: "Alice" });
        expect(body.token).toBe("new-token-123");
        expect(mockTripUserService.getTripUserWithToken).not.toHaveBeenCalled();
    });

    test("returns existing token when seat already claimed (idempotent)", async () => {
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());
        mockTripUserService.claimSeat.mockResolvedValueOnce(null);
        mockTripUserService.getTripUserWithToken.mockResolvedValueOnce({
            _id: USER_ID, name: "Alice", token: "existing-token",
        });

        const res = await fetch(`${baseUrl}/migrate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": USER_ID },
            body: JSON.stringify({ tripId: TRIP_ID }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(decodeId(body.encodedId)).toBe(TRIP_ID);
        expect(body.token).toBe("existing-token");
        expect(body.user).toEqual({ _id: USER_ID, name: "Alice" });
    });

    test("rejects user not part of the trip (403)", async () => {
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());

        const res = await fetch(`${baseUrl}/migrate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": STRANGER_ID },
            body: JSON.stringify({ tripId: TRIP_ID }),
        });

        expect(res.status).toBe(403);
    });

    test("rejects missing tripId (422)", async () => {
        const res = await fetch(`${baseUrl}/migrate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });

        expect(res.status).toBe(422);
    });

    test("rejects invalid tripId format (422)", async () => {
        const res = await fetch(`${baseUrl}/migrate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tripId: "not-an-objectid" }),
        });

        expect(res.status).toBe(422);
    });

    test("returns 404 when trip not found", async () => {
        const { NotFoundError } = await import("../../utils/errors.mjs");
        mockTripService.getTrip.mockRejectedValueOnce(new NotFoundError("Cannot find trip"));

        const res = await fetch(`${baseUrl}/migrate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tripId: TRIP_ID }),
        });

        expect(res.status).toBe(404);
    });
});
