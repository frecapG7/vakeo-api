import { jest } from "@jest/globals";

// --- Mock the DB-dependent services ---
// Every named export the v3 events route graph imports must be present here:
// ESM validates named imports against the mock at load time.
const mockTripService = {
    getTrip: jest.fn(),
};

const mockTripUserService = {
    getTripUserByToken: jest.fn(),
};

const mockEventsService = {
    search: jest.fn(),
    getEvent: jest.fn(),
    createEvent: jest.fn(),
    updateEvent: jest.fn(),
    withEventCounts: jest.fn(),
    withEventCount: jest.fn(),
};

jest.unstable_mockModule("../../services/tripService.mjs", () => mockTripService);
jest.unstable_mockModule("../../services/tripUserService.mjs", () => mockTripUserService);
jest.unstable_mockModule("../../services/eventsService.mjs", () => mockEventsService);

const { encodeId } = await import("../../services/idEncoderService.mjs");

const encoded = encodeId("trip123");

const fakeTrip = (overrides = {}) => ({
    _id: "trip123",
    users: ["member1", "member2"],
    isPrivate: false,
    ...overrides,
});

const memberUser = { _id: "member1", name: "Alice", token: "tok-alice" };
const strangerUser = { _id: "stranger", name: "Stranger", token: "tok-stranger" };

const authenticateAs = (user) =>
    mockTripUserService.getTripUserByToken.mockResolvedValue(user);

let app, server, baseUrl;

beforeAll(async () => {
    const express = (await import("express")).default;
    const passport = (await import("passport")).default;
    const { HeaderAPIKeyStrategy } = await import("passport-headerapikey");
    const AnonymousStrategy = (await import("passport-anonymous")).default;
    const { getTripUserByToken } = await import("../../services/tripUserService.mjs");
    const { handleError } = await import("../../middlewares/errorMiddleware.mjs");
    const eventsRouter = (await import("./events.mjs")).default;

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
    app.use(eventsRouter);
    app.use(handleError);

    server = app.listen(0);
    baseUrl = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
    jest.clearAllMocks();
    mockTripService.getTrip.mockResolvedValue(fakeTrip());
    // Identity by default: the counting layer is transparent for the delegation
    // and access tests, and asserted on its own in the counts block below.
    mockEventsService.withEventCounts.mockImplementation(async (tripId, events) => events ?? []);
    mockEventsService.withEventCount.mockImplementation(async (tripId, event) => event);
});

describe("v3 events — access", () => {
    test("public trip: anonymous can list events", async () => {
        mockEventsService.search.mockResolvedValue([]);

        const res = await fetch(`${baseUrl}/trips/${encoded}/events`);

        expect(res.status).toBe(200);
    });

    test("private trip: anonymous gets 403 on reads", async () => {
        mockTripService.getTrip.mockResolvedValue(fakeTrip({ isPrivate: true }));

        const res = await fetch(`${baseUrl}/trips/${encoded}/events`);

        expect(res.status).toBe(403);
    });

    test("private trip: non-member gets 403 on reads", async () => {
        authenticateAs(strangerUser);
        mockTripService.getTrip.mockResolvedValue(fakeTrip({ isPrivate: true }));

        const res = await fetch(`${baseUrl}/trips/${encoded}/events`, {
            headers: { "x-user-token": strangerUser.token },
        });

        expect(res.status).toBe(403);
    });

    test("mutation without auth gets 401", async () => {
        const res = await fetch(`${baseUrl}/trips/${encoded}/events`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "Dîner", type: "MEAL" }),
        });

        expect(res.status).toBe(401);
    });

    test("mutation as non-member gets 403", async () => {
        authenticateAs(strangerUser);

        const res = await fetch(`${baseUrl}/trips/${encoded}/events`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-user-token": strangerUser.token,
            },
            body: JSON.stringify({ name: "Dîner", type: "MEAL" }),
        });

        expect(res.status).toBe(403);
        expect(mockEventsService.createEvent).not.toHaveBeenCalled();
    });
});

describe("v3 events — delegation", () => {
    test("list: the service receives the raw trip id and the sanitized limit", async () => {
        mockEventsService.search.mockResolvedValue([]);

        await fetch(`${baseUrl}/trips/${encoded}/events?limit=500`);

        expect(mockEventsService.search).toHaveBeenCalledWith(
            "trip123",
            expect.objectContaining({ limit: 100 })
        );
    });

    test("list: the default limit is 10", async () => {
        mockEventsService.search.mockResolvedValue([]);

        await fetch(`${baseUrl}/trips/${encoded}/events`);

        expect(mockEventsService.search).toHaveBeenCalledWith(
            "trip123",
            expect.objectContaining({ limit: 10 })
        );
    });

    test("list: nextCursor is null when the page is shorter than the limit", async () => {
        mockEventsService.search.mockResolvedValue([{ _id: "evt1", startDate: "2026-01-01" }]);

        const res = await fetch(`${baseUrl}/trips/${encoded}/events?limit=2`);
        const body = await res.json();

        expect(body.nextCursor).toBeNull();
    });

    test("list: nextCursor encodes the last item when the page is full", async () => {
        mockEventsService.search.mockResolvedValue([
            { _id: "evt1", startDate: "2026-01-01T00:00:00.000Z" },
            { _id: "evt2", startDate: "2026-01-02T00:00:00.000Z" },
        ]);

        const res = await fetch(`${baseUrl}/trips/${encoded}/events?limit=2`);
        const body = await res.json();

        const decoded = JSON.parse(Buffer.from(body.nextCursor, "base64").toString("utf-8"));
        expect(decoded).toEqual({
            _id: "evt2",
            startDate: "2026-01-02T00:00:00.000Z",
        });
    });

    test("detail: returns the event from the service", async () => {
        mockEventsService.getEvent.mockResolvedValue({ _id: "evt1", name: "Dîner" });

        const res = await fetch(`${baseUrl}/trips/${encoded}/events/evt1`);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.name).toBe("Dîner");
        expect(mockEventsService.getEvent).toHaveBeenCalledWith("trip123", "evt1");
    });

    test("create: delegates to the service with the trip and the body", async () => {
        authenticateAs(memberUser);
        mockEventsService.createEvent.mockResolvedValue({ _id: "evt1" });

        const res = await fetch(`${baseUrl}/trips/${encoded}/events`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-user-token": memberUser.token,
            },
            body: JSON.stringify({ name: "Dîner", type: "MEAL" }),
        });

        expect(res.status).toBe(201);
        expect(mockEventsService.createEvent).toHaveBeenCalledWith(
            expect.objectContaining({ _id: "trip123" }),
            expect.objectContaining({ name: "Dîner" })
        );
    });

    test("update: the document returned by getEvent is handed to updateEvent", async () => {
        authenticateAs(memberUser);
        const storedEvent = { _id: "evt1", name: "Dîner" };
        mockEventsService.getEvent.mockResolvedValue(storedEvent);
        mockEventsService.updateEvent.mockImplementation(async (event, body) => ({
            ...event,
            ...body,
        }));

        const res = await fetch(`${baseUrl}/trips/${encoded}/events/evt1`, {
            method: "PUT",
            headers: {
                "content-type": "application/json",
                "x-user-token": memberUser.token,
            },
            body: JSON.stringify({ name: "Brunch" }),
        });

        expect(res.status).toBe(200);
        expect(mockEventsService.updateEvent.mock.calls[0][0]).toBe(storedEvent);
    });

    test("delete: a non-owner gets 403", async () => {
        authenticateAs(memberUser);
        mockEventsService.getEvent.mockResolvedValue({ _id: "evt1", owners: [] });

        const res = await fetch(`${baseUrl}/trips/${encoded}/events/evt1`, {
            method: "DELETE",
            headers: { "x-user-token": memberUser.token },
        });

        expect(res.status).toBe(403);
    });

    test("delete: an owner reaches the not-implemented stub (501)", async () => {
        authenticateAs(memberUser);
        mockEventsService.getEvent.mockResolvedValue({
            _id: "evt1",
            owners: [{ _id: { equals: () => true } }],
        });

        const res = await fetch(`${baseUrl}/trips/${encoded}/events/evt1`, {
            method: "DELETE",
            headers: { "x-user-token": memberUser.token },
        });

        expect(res.status).toBe(501);
    });
});

describe("v3 events — counts", () => {
    test("list: every event carries its counts", async () => {
        mockEventsService.search.mockResolvedValue([{ _id: "evt1" }, { _id: "evt2" }]);
        mockEventsService.withEventCounts.mockResolvedValue([
            {
                _id: "evt1",
                messageCount: 12,
                lastMessageAt: "2026-01-02T10:00:00.000Z",
                goodsCount: { total: 8, missing: 3 },
            },
            { _id: "evt2", messageCount: 0, lastMessageAt: null, goodsCount: { total: 0, missing: 0 } },
        ]);

        const res = await fetch(`${baseUrl}/trips/${encoded}/events`);
        const body = await res.json();

        expect(body.events[0].messageCount).toBe(12);
        expect(body.events[0].goodsCount).toEqual({ total: 8, missing: 3 });
        expect(body.events[1].lastMessageAt).toBeNull();
        expect(body.events[1].goodsCount).toEqual({ total: 0, missing: 0 });
        expect(mockEventsService.withEventCounts).toHaveBeenCalledWith("trip123", [
            { _id: "evt1" },
            { _id: "evt2" },
        ]);
    });

    test("detail: counts are attached to the returned event", async () => {
        const storedEvent = { _id: "evt1", name: "Dîner" };
        mockEventsService.getEvent.mockResolvedValue(storedEvent);
        mockEventsService.withEventCount.mockResolvedValue({
            ...storedEvent,
            messageCount: 2,
            lastMessageAt: null,
            goodsCount: { total: 1, missing: 1 },
        });

        const res = await fetch(`${baseUrl}/trips/${encoded}/events/evt1`);
        const body = await res.json();

        expect(body.messageCount).toBe(2);
        expect(body.goodsCount).toEqual({ total: 1, missing: 1 });
        expect(mockEventsService.withEventCount).toHaveBeenCalledWith("trip123", storedEvent);
    });

    test("update: the mutation path never goes through the counting layer", async () => {
        authenticateAs(memberUser);
        mockEventsService.getEvent.mockResolvedValue({ _id: "evt1" });
        mockEventsService.updateEvent.mockResolvedValue({ _id: "evt1", name: "Brunch" });

        const res = await fetch(`${baseUrl}/trips/${encoded}/events/evt1`, {
            method: "PUT",
            headers: {
                "content-type": "application/json",
                "x-user-token": memberUser.token,
            },
            body: JSON.stringify({ name: "Brunch" }),
        });

        expect(res.status).toBe(200);
        expect(mockEventsService.withEventCount).not.toHaveBeenCalled();
        expect(mockEventsService.withEventCounts).not.toHaveBeenCalled();
    });
});
