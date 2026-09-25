import { jest } from "@jest/globals";
import { InvalidError } from "../../utils/errors.mjs";

// --- Mock the DB-dependent services ---
// All functions the v3 trips route and the passport strategy touch go here.
const mockTripUserService = {
    createTripUsers: jest.fn(),
    getTripUserByToken: jest.fn(),
    getTripUserById: jest.fn(),
    addSeatsToTrip: jest.fn(),
    rotateTripUserToken: jest.fn(),
    claimSeat: jest.fn(),
    releaseSeat: jest.fn(),
};

const mockTripService = {
    getTrip: jest.fn(),
    createTrip: jest.fn(),
    deleteTrip: jest.fn(),
    updateTrip: jest.fn(),
    dashboard: jest.fn(),
    batchHydrate: jest.fn(),
};

const mockJoinTokenService = {
    generateJoinToken: jest.fn(),
    verifyJoinToken: jest.fn(),
};

const mockTripUserModel = {
    find: jest.fn(),
};

jest.unstable_mockModule("../../services/tripService.mjs", () => mockTripService);
jest.unstable_mockModule("../../services/tripUserService.mjs", () => mockTripUserService);
jest.unstable_mockModule("../../services/joinTokenService.mjs", () => mockJoinTokenService);
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
    const tripsRouter = (await import("./trips.mjs")).default;

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
    app.use("/trips", tripsRouter);
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
    toObject() { return { ...this, ...overrides }; },
    populate: async function () { return this; },
    ...overrides,
});

const fakePrivateTrip = (overrides = {}) => fakeTrip({ isPrivate: true, ...overrides });

const memberUser = { _id: "member1", name: "Alice", token: "tok-alice" };
const strangerUser = { _id: "stranger", name: "Stranger", token: "tok-stranger" };


describe("POST /trips (create — no auth, bootstrap)", () => {

    test("creates a trip, auto-claims first seat, returns seats + credentials", async () => {
        const fakeUsers = [
            { _id: "member1", name: "Alice", avatar: "img1" },
            { _id: "member2", name: "Bob", avatar: "img2" },
        ];
        mockTripUserService.createTripUsers.mockResolvedValueOnce(fakeUsers);
        mockTripService.createTrip.mockResolvedValueOnce(fakeTrip());
        mockTripUserService.claimSeat.mockResolvedValueOnce({
            _id: "member1", name: "Alice", token: "tok-alice-43chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        });

        const res = await fetch(`${baseUrl}/trips`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "Summer",
                users: [{ name: "Alice" }, { name: "Bob" }],
            }),
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.name).toBe("Summer");
        expect(body.encodedId).toBeDefined();
        expect(body.seats).toHaveLength(2);
        expect(body.seats[0].token).toBeUndefined();
        expect(body.credentials._id).toBe("member1");
        expect(body.credentials.token).toBe("tok-alice-43chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    });

    test("rejects trip with 0 users (422)", async () => {
        const res = await fetch(`${baseUrl}/trips`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Empty", users: [] }),
        });
        expect(res.status).toBe(422);
    });

    test("rejects trip with more than 20 users (422)", async () => {
        const users = Array.from({ length: 21 }, (_, i) => ({ name: `User${i}` }));
        const res = await fetch(`${baseUrl}/trips`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Big", users }),
        });
        expect(res.status).toBe(422);
    });
});


describe("GET /trips/:tripId (read access)", () => {

    test("public trip: readable without auth (200)", async () => {
        const encoded = encodeId("trip123");
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());

        const res = await fetch(`${baseUrl}/trips/${encoded}`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.name).toBe("Summer");
    });

    test("public trip: readable with any valid token (200)", async () => {
        const encoded = encodeId("trip123");
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce({
            _id: "stranger", name: "Stranger", token: "tok-stranger",
        });
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());

        const res = await fetch(`${baseUrl}/trips/${encoded}`, {
            headers: { "x-user-token": "tok-stranger" },
        });
        expect(res.status).toBe(200);
    });

    test("private trip: returns 403 without auth", async () => {
        const encoded = encodeId("trip123");
        mockTripService.getTrip.mockResolvedValueOnce(fakePrivateTrip());

        const res = await fetch(`${baseUrl}/trips/${encoded}`);
        expect(res.status).toBe(403);
    });

    test("private trip: returns 403 when not a member", async () => {
        const encoded = encodeId("trip123");
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce({
            _id: "stranger", name: "Stranger", token: "tok-stranger",
        });
        mockTripService.getTrip.mockResolvedValueOnce(fakePrivateTrip());

        const res = await fetch(`${baseUrl}/trips/${encoded}`, {
            headers: { "x-user-token": "tok-stranger" },
        });
        expect(res.status).toBe(403);
    });

    test("private trip: readable when authenticated member (200)", async () => {
        const encoded = encodeId("trip123");
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce({
            _id: "member1", name: "Alice", token: "tok-alice",
        });
        mockTripService.getTrip.mockResolvedValueOnce(fakePrivateTrip());

        const res = await fetch(`${baseUrl}/trips/${encoded}`, {
            headers: { "x-user-token": "tok-alice" },
        });
        expect(res.status).toBe(200);
    });

    test("returns 422 on tampered encoded id", async () => {
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce({
            _id: "member1", name: "Alice", token: "tok-alice",
        });
        const res = await fetch(`${baseUrl}/trips/garbage-id`, {
            headers: { "x-user-token": "tok-alice" },
        });
        expect(res.status).toBe(422);
    });
});


describe("DELETE /trips/:tripId (auth + membership)", () => {

    test("returns 401 without auth", async () => {
        const encoded = encodeId("trip123");
        const res = await fetch(`${baseUrl}/trips/${encoded}`, { method: "DELETE" });
        expect(res.status).toBe(401);
    });

    test("deletes trip when authenticated member", async () => {
        const encoded = encodeId("trip123");
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce({
            _id: "member1", name: "Alice", token: "tok-alice",
        });
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());
        mockTripService.deleteTrip.mockResolvedValueOnce();

        const res = await fetch(`${baseUrl}/trips/${encoded}`, {
            method: "DELETE",
            headers: { "x-user-token": "tok-alice" },
        });
        expect(res.status).toBe(204);
    });

    test("returns 403 when not a member", async () => {
        const encoded = encodeId("trip123");
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce({
            _id: "stranger", name: "Stranger", token: "tok-stranger",
        });
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());

        const res = await fetch(`${baseUrl}/trips/${encoded}`, {
            method: "DELETE",
            headers: { "x-user-token": "tok-stranger" },
        });
        expect(res.status).toBe(403);
    });
});


describe("POST /trips/batch (delegates to tripService.batchHydrate)", () => {

    test("returns the trips hydrated by the service", async () => {
        mockTripService.batchHydrate.mockResolvedValueOnce([
            { _id: "pub1", name: "Public", isPrivate: false },
        ]);

        const res = await fetch(`${baseUrl}/trips/batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                trips: [{ id: "any" }, { id: "other", token: "tok" }],
            }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.trips).toHaveLength(1);
        expect(body.trips[0].name).toBe("Public");
        expect(mockTripService.batchHydrate).toHaveBeenCalledWith([
            { id: "any" },
            { id: "other", token: "tok" },
        ]);
    });

    test("propagates the service validation error (422)", async () => {
        mockTripService.batchHydrate.mockRejectedValueOnce(
            new InvalidError("Cannot fetch trips: `trips` must be a non-empty array")
        );

        const res = await fetch(`${baseUrl}/trips/batch`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        expect(res.status).toBe(422);
    });
});


describe("POST /trips/:tripId/share", () => {

    test("private trip: returns joinToken (member only)", async () => {
        const encoded = encodeId("trip123");
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(memberUser);
        mockTripService.getTrip.mockResolvedValueOnce(fakePrivateTrip());
        mockJoinTokenService.generateJoinToken.mockResolvedValueOnce("mock-join-token");

        const res = await fetch(`${baseUrl}/trips/${encoded}/share`, {
            method: "POST",
            headers: { "x-user-token": "tok-alice" },
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.type).toBe("joinToken");
        expect(body.value).toBe("mock-join-token");
    });

    test("public trip: returns joinToken (universal token)", async () => {
        const encoded = encodeId("trip123");
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(memberUser);
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());
        mockJoinTokenService.generateJoinToken.mockResolvedValueOnce("mock-join-token");

        const res = await fetch(`${baseUrl}/trips/${encoded}/share`, {
            method: "POST",
            headers: { "x-user-token": "tok-alice" },
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.type).toBe("joinToken");
        expect(body.value).toBe("mock-join-token");
    });

    test("non-member gets 403", async () => {
        const encoded = encodeId("trip123");
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(strangerUser);
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());

        const res = await fetch(`${baseUrl}/trips/${encoded}/share`, {
            method: "POST",
            headers: { "x-user-token": "tok-stranger" },
        });
        expect(res.status).toBe(403);
    });
});


describe("POST /trips/:tripId/join", () => {

    test("private trip: claims a free seat with valid joinToken (200)", async () => {
        const encoded = encodeId("trip123");
        mockTripService.getTrip.mockResolvedValueOnce(fakePrivateTrip());
        mockJoinTokenService.verifyJoinToken.mockResolvedValueOnce({ sub: "trip123", role: "join" });
        mockTripUserService.claimSeat.mockResolvedValueOnce({
            _id: "member2", name: "Bob", avatar: "pic", token: "tok-bob",
        });

        const res = await fetch(`${baseUrl}/trips/${encoded}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ joinToken: "valid-token", tripUserId: "member2" }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.user._id).toBe("member2");
        expect(body.token).toBe("tok-bob");
    });

    test("private trip: 403 without joinToken", async () => {
        const encoded = encodeId("trip123");
        mockTripService.getTrip.mockResolvedValueOnce(fakePrivateTrip());

        const res = await fetch(`${baseUrl}/trips/${encoded}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tripUserId: "member2" }),
        });
        expect(res.status).toBe(403);
    });

    test("private trip: 403 when seat already taken (claimSeat returns null)", async () => {
        const encoded = encodeId("trip123");
        mockTripService.getTrip.mockResolvedValueOnce(fakePrivateTrip());
        mockJoinTokenService.verifyJoinToken.mockResolvedValueOnce({ sub: "trip123", role: "join" });
        mockTripUserService.claimSeat.mockResolvedValueOnce(null);

        const res = await fetch(`${baseUrl}/trips/${encoded}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ joinToken: "valid-token", tripUserId: "member1" }),
        });
        expect(res.status).toBe(403);
    });

    test("public trip: claim existing free seat (200)", async () => {
        const encoded = encodeId("trip123");
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());
        mockTripUserService.claimSeat.mockResolvedValueOnce({
            _id: "member2", name: "Bob", avatar: "pic", token: "tok-bob",
        });

        const res = await fetch(`${baseUrl}/trips/${encoded}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tripUserId: "member2" }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.token).toBe("tok-bob");
    });

    test("public trip: create a new seat (200)", async () => {
        const encoded = encodeId("trip123");
        const trip = { ...fakeTrip(), save: async () => {} };
        mockTripService.getTrip.mockResolvedValueOnce(trip);
        mockTripUserService.addSeatsToTrip.mockResolvedValueOnce([{
            _id: "newuser", name: "Charlie", avatar: "avatar",
        }]);
        mockTripUserService.claimSeat.mockResolvedValueOnce({
            _id: "newuser", name: "Charlie", avatar: "avatar", token: "tok-charlie",
        });

        const res = await fetch(`${baseUrl}/trips/${encoded}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Charlie" }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.user.name).toBe("Charlie");
        expect(body.token).toBe("tok-charlie");
    });

    test("public trip: pass — browse anonymously (200)", async () => {
        const encoded = encodeId("trip123");
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());

        const res = await fetch(`${baseUrl}/trips/${encoded}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.anonymous).toBe(true);
    });
});


describe("POST /trips/:tripId/leave", () => {

    test("member leaves — releases seat (204)", async () => {
        const encoded = encodeId("trip123");
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(memberUser);
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());
        mockTripUserService.releaseSeat.mockResolvedValueOnce({});

        const res = await fetch(`${baseUrl}/trips/${encoded}/leave`, {
            method: "POST",
            headers: { "x-user-token": "tok-alice" },
        });
        expect(res.status).toBe(204);
    });

    test("non-member gets 403", async () => {
        const encoded = encodeId("trip123");
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(strangerUser);
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());

        const res = await fetch(`${baseUrl}/trips/${encoded}/leave`, {
            method: "POST",
            headers: { "x-user-token": "tok-stranger" },
        });
        expect(res.status).toBe(403);
    });

    test("anonymous gets 401", async () => {
        const encoded = encodeId("trip123");
        const res = await fetch(`${baseUrl}/trips/${encoded}/leave`, {
            method: "POST",
        });
        expect(res.status).toBe(401);
    });
});
