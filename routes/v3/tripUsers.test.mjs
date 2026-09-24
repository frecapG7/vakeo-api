import { jest } from "@jest/globals";

// --- Mock the DB-dependent services ---
// All functions the v3 tripUsers route and the passport strategy touch go here.
const mockTripService = {
    getTrip: jest.fn(),
};

const mockTripUserService = {
    getTripUserByToken: jest.fn(),
    getTripUserById: jest.fn(),
    rotateTripUserToken: jest.fn(),
    addSeatsToTrip: jest.fn(),
};

const mockTripUserModel = {
    find: jest.fn(),
};

jest.unstable_mockModule("../../services/tripService.mjs", () => mockTripService);
jest.unstable_mockModule("../../services/tripUserService.mjs", () => mockTripUserService);
jest.unstable_mockModule("../../models/tripUserModel.mjs", () => ({ default: mockTripUserModel }));

// --- Build the test app ---
const { encodeId } = await import("../../services/idEncoderService.mjs");

let app, server, baseUrl;

beforeAll(async () => {
    const express = (await import("express")).default;
    const passport = (await import("passport")).default;
    const { HeaderAPIKeyStrategy } = await import("passport-headerapikey");
    const AnonymousStrategy = (await import("passport-anonymous")).default;
    const { getTripUserByToken } = await import("../../services/tripUserService.mjs");
    const { handleError } = await import("../../middlewares/errorMiddleware.mjs");
    const tripUsersRouter = (await import("./tripUsers.mjs")).default;

    passport.use(
        "user-token",
        new HeaderAPIKeyStrategy(
            { header: "x-user-token", prefix: "" },
            false,
            async (token, done) => {
                const user = await getTripUserByToken(token);
                if (user) return done(null, user);
                return done(null, false, { message: "Invalid token" });
            }
        )
    );
    passport.use(new AnonymousStrategy());

    app = express();
    app.use(express.json());
    app.use(passport.initialize());
    app.use(tripUsersRouter);
    app.use(handleError);

    server = app.listen(0);
    baseUrl = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
    await new Promise((r) => server.close(r));
});

// Helper: a fake trip-like object
const fakeTrip = (overrides = {}) => ({
    _id: "trip123",
    name: "Summer",
    users: ["member1", "member2"],
    isPrivate: false,
    ...overrides,
});

const memberUser = { _id: "member1", name: "Alice", token: "tok-alice" };
const strangerUser = { _id: "stranger", name: "Stranger", token: "tok-stranger" };

describe("POST /trips/:tripId/users/:tripUserId/rotate-token (seat owner only)", () => {
    const encoded = encodeId("trip123");

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("seat owner rotates their own token (200)", async () => {
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(memberUser);
        mockTripUserService.rotateTripUserToken.mockResolvedValueOnce("new-tok-alice");

        const res = await fetch(`${baseUrl}/trips/${encoded}/users/member1/rotate-token`, {
            method: "POST",
            headers: { "x-user-token": "tok-alice" },
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.token).toBe("new-tok-alice");
        expect(mockTripUserService.rotateTripUserToken).toHaveBeenCalledWith("member1");
    });

    test("member cannot rotate another member's token (403)", async () => {
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(memberUser);

        const res = await fetch(`${baseUrl}/trips/${encoded}/users/member2/rotate-token`, {
            method: "POST",
            headers: { "x-user-token": "tok-alice" },
        });
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.message).toBe("Only the seat owner can perform this action");
        expect(mockTripUserService.rotateTripUserToken).not.toHaveBeenCalled();
    });

    test("member cannot rotate a seat outside the trip (403)", async () => {
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(memberUser);

        const res = await fetch(`${baseUrl}/trips/${encoded}/users/outsider/rotate-token`, {
            method: "POST",
            headers: { "x-user-token": "tok-alice" },
        });
        expect(res.status).toBe(403);
        expect(mockTripUserService.rotateTripUserToken).not.toHaveBeenCalled();
    });

    test("non-member cannot rotate any seat (403)", async () => {
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(strangerUser);

        const res = await fetch(`${baseUrl}/trips/${encoded}/users/member1/rotate-token`, {
            method: "POST",
            headers: { "x-user-token": "tok-stranger" },
        });
        expect(res.status).toBe(403);
        expect(mockTripUserService.rotateTripUserToken).not.toHaveBeenCalled();
    });

    test("anonymous cannot rotate a token (401)", async () => {
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());

        const res = await fetch(`${baseUrl}/trips/${encoded}/users/member1/rotate-token`, {
            method: "POST",
        });
        expect(res.status).toBe(401);
        expect(mockTripUserService.rotateTripUserToken).not.toHaveBeenCalled();
    });
});
