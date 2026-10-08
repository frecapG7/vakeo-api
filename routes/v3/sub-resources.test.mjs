import { jest } from "@jest/globals";
import { InvalidError, NotFoundError } from "../../utils/errors.mjs";

// --- Mock all DB-dependent services ---
const mockTripService = {
    getTrip: jest.fn(),
};

const mockTripStopService = {
    getTripStops: jest.fn(),
    getTripStop: jest.fn(),
    createTripStop: jest.fn(),
    updateTripStop: jest.fn(),
    deleteTripStop: jest.fn(),
};

const mockGoodsService = {
    search: jest.fn(),
    getGood: jest.fn(),
    createGood: jest.fn(),
    checkGood: jest.fn(),
    checkMultipleGoods: jest.fn(),
    updateGood: jest.fn(),
};

const mockPollsService = {
    searchPolls: jest.fn(),
    getPoll: jest.fn(),
    createPoll: jest.fn(),
    updatePoll: jest.fn(),
    votePoll: jest.fn(),
    unvotePoll: jest.fn(),
    deletePoll: jest.fn(),
};

const mockTripUserService = {
    getTripUserByToken: jest.fn(),
    createTripUser: jest.fn(),
    getTripUserById: jest.fn(),
    createTripUsers: jest.fn(),
    rotateTripUserToken: jest.fn(),
    claimSeat: jest.fn(),
    releaseSeat: jest.fn(),
};
const mockMessageService = {
    createMessage: jest.fn(),
    deleteMessage: jest.fn(),
    search: jest.fn(),
    getHubConversations: jest.fn(),
    getUnreadConversationCount: jest.fn(),
    markAllMessagesAsRead: jest.fn(),
    addReaction: jest.fn(),
    removeReaction: jest.fn(),
};

jest.unstable_mockModule("../../services/tripService.mjs", () => mockTripService);
jest.unstable_mockModule("../../services/tripStopService.mjs", () => mockTripStopService);
jest.unstable_mockModule("../../services/goodsService.mjs", () => mockGoodsService);
jest.unstable_mockModule("../../services/pollsService.mjs", () => mockPollsService);
jest.unstable_mockModule("../../services/tripUserService.mjs", () => mockTripUserService);
jest.unstable_mockModule("../../services/messageService.mjs", () => mockMessageService);

const { encodeId } = await import("../../services/idEncoderService.mjs");

let app, server, baseUrl;

beforeAll(async () => {
    const express = (await import("express")).default;
    const passport = (await import("passport")).default;
    const { HeaderAPIKeyStrategy } = await import("passport-headerapikey");
    const AnonymousStrategy = (await import("passport-anonymous")).default;
    const { getTripUserByToken } = await import("../../services/tripUserService.mjs");
    const { handleError } = await import("../../middlewares/errorMiddleware.mjs");

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

    const tripStops = (await import("./tripStops.mjs")).default;
    const goods = (await import("./goods.mjs")).default;
    const polls = (await import("./polls.mjs")).default;

    const messages = (await import("./messages.mjs")).default;

    app.use(tripStops);
    app.use(goods);
    app.use(polls);
    app.use(messages);
    app.use(handleError);

    server = app.listen(0);
    baseUrl = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
    await new Promise((r) => server.close(r));
});

const fakeTrip = (overrides = {}) => ({
    _id: "trip123",
    users: ["member1", "member2"],
    isPrivate: false,
    ...overrides,
});

const memberUser = { _id: "member1", name: "Alice", token: "tok-alice" };
const strangerUser = { _id: "stranger", name: "Stranger", token: "tok-stranger" };

// --- Stops ---
describe("v3 tripStops", () => {
    const encoded = encodeId("trip123");

    test("public trip: anonymous can read stops (200)", async () => {
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());
        mockTripStopService.getTripStops.mockResolvedValueOnce([]);

        const res = await fetch(`${baseUrl}/trips/${encoded}/stops`);
        expect(res.status).toBe(200);
    });

    test("private trip: anonymous gets 403 on reads", async () => {
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip({ isPrivate: true }));

        const res = await fetch(`${baseUrl}/trips/${encoded}/stops`);
        expect(res.status).toBe(403);
    });

    test("private trip: non-member gets 403 on reads", async () => {
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(strangerUser);
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip({ isPrivate: true }));

        const res = await fetch(`${baseUrl}/trips/${encoded}/stops`, {
            headers: { "x-user-token": "tok-stranger" },
        });
        expect(res.status).toBe(403);
    });

    test("private trip: member can read stops (200)", async () => {
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(memberUser);
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip({ isPrivate: true }));
        mockTripStopService.getTripStops.mockResolvedValueOnce([]);

        const res = await fetch(`${baseUrl}/trips/${encoded}/stops`, {
            headers: { "x-user-token": "tok-alice" },
        });
        expect(res.status).toBe(200);
    });

    test("mutation without auth gets 401", async () => {
        const res = await fetch(`${baseUrl}/trips/${encoded}/stops`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Stop 1" }),
        });
        expect(res.status).toBe(401);
    });

    test("mutation as member succeeds (201)", async () => {
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(memberUser);
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());
        mockTripStopService.createTripStop.mockResolvedValueOnce({ _id: "stop1", name: "Stop 1" });

        const res = await fetch(`${baseUrl}/trips/${encoded}/stops`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-token": "tok-alice" },
            body: JSON.stringify({ name: "Stop 1" }),
        });
        expect(res.status).toBe(201);
    });

    test("mutation as non-member gets 403", async () => {
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(strangerUser);
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());

        const res = await fetch(`${baseUrl}/trips/${encoded}/stops`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-token": "tok-stranger" },
            body: JSON.stringify({ name: "Stop 1" }),
        });
        expect(res.status).toBe(403);
    });
});

// --- Goods ---
describe("v3 goods", () => {
    const encoded = encodeId("trip123");

    test("public trip: anonymous can read goods (200)", async () => {
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());
        mockGoodsService.search.mockResolvedValueOnce([]);

        const res = await fetch(`${baseUrl}/trips/${encoded}/goods`);
        expect(res.status).toBe(200);
    });

    test("private trip: anonymous gets 403", async () => {
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip({ isPrivate: true }));

        const res = await fetch(`${baseUrl}/trips/${encoded}/goods`);
        expect(res.status).toBe(403);
    });

    test("mutation as member succeeds (201)", async () => {
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(memberUser);
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());
        mockGoodsService.createGood.mockResolvedValueOnce({ _id: "good1" });

        const res = await fetch(`${baseUrl}/trips/${encoded}/goods`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-token": "tok-alice" },
            body: JSON.stringify({ name: "Bread" }),
        });
        expect(res.status).toBe(201);
    });

    test("mutation as non-member gets 403", async () => {
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(strangerUser);
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());

        const res = await fetch(`${baseUrl}/trips/${encoded}/goods`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-token": "tok-stranger" },
            body: JSON.stringify({ name: "Bread" }),
        });
        expect(res.status).toBe(403);
    });
});

// --- Polls ---
describe("v3 polls", () => {
    const encoded = encodeId("trip123");

    test("public trip: anonymous can read polls (200)", async () => {
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());
        mockPollsService.searchPolls.mockResolvedValueOnce([]);

        const res = await fetch(`${baseUrl}/trips/${encoded}/polls`);
        expect(res.status).toBe(200);
    });

    test("private trip: anonymous gets 403", async () => {
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip({ isPrivate: true }));

        const res = await fetch(`${baseUrl}/trips/${encoded}/polls`);
        expect(res.status).toBe(403);
    });

    test("mutation as member succeeds (201)", async () => {
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(memberUser);
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());
        mockPollsService.createPoll.mockResolvedValueOnce({ _id: "poll1" });

        const res = await fetch(`${baseUrl}/trips/${encoded}/polls`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-token": "tok-alice" },
            body: JSON.stringify({ question: "When?", type: "DatesPoll", options: [] }),
        });
        expect(res.status).toBe(201);
    });

    test("mutation as non-member gets 403", async () => {
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(strangerUser);
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());

        const res = await fetch(`${baseUrl}/trips/${encoded}/polls`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-token": "tok-stranger" },
            body: JSON.stringify({ question: "When?", type: "DatesPoll", options: [] }),
        });
        expect(res.status).toBe(403);
    });
});

// --- Messages: reactions ---
describe("v3 message reactions", () => {
    const encoded = encodeId("trip123");

    test("member can react to a message (200, reactions returned)", async () => {
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(memberUser);
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());
        mockMessageService.addReaction.mockResolvedValueOnce([{ emoji: "\u{1F44D}", users: ["member1"] }]);

        const res = await fetch(`${baseUrl}/trips/${encoded}/messages/msg1/reactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-token": "tok-alice" },
            body: JSON.stringify({ emoji: "\u{1F44D}" }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.reactions).toEqual([{ emoji: "\u{1F44D}", users: ["member1"] }]);
        expect(mockMessageService.addReaction).toHaveBeenCalledWith("trip123", "msg1", "member1", "\u{1F44D}");
    });

    test("anonymous gets 401 on reactions", async () => {
        const res = await fetch(`${baseUrl}/trips/${encoded}/messages/msg1/reactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ emoji: "\u{1F44D}" }),
        });
        expect(res.status).toBe(401);
    });

    test("non-member gets 403 on reactions", async () => {
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(strangerUser);
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());

        const res = await fetch(`${baseUrl}/trips/${encoded}/messages/msg1/reactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-token": "tok-stranger" },
            body: JSON.stringify({ emoji: "\u{1F44D}" }),
        });
        expect(res.status).toBe(403);
    });

    test("disallowed emoji surfaces 422", async () => {
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(memberUser);
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());
        mockMessageService.addReaction.mockRejectedValueOnce(new InvalidError("Emoji must be one of the allowed reactions"));

        const res = await fetch(`${baseUrl}/trips/${encoded}/messages/msg1/reactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-token": "tok-alice" },
            body: JSON.stringify({ emoji: "\u{1F419}" }),
        });
        expect(res.status).toBe(422);
    });

    test("unknown message surfaces 404", async () => {
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(memberUser);
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());
        mockMessageService.addReaction.mockRejectedValueOnce(new NotFoundError("Message msgX not found"));

        const res = await fetch(`${baseUrl}/trips/${encoded}/messages/msgX/reactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-token": "tok-alice" },
            body: JSON.stringify({ emoji: "\u{1F44D}" }),
        });
        expect(res.status).toBe(404);
    });

    test("member can remove a reaction (200)", async () => {
        mockTripUserService.getTripUserByToken.mockResolvedValueOnce(memberUser);
        mockTripService.getTrip.mockResolvedValueOnce(fakeTrip());
        mockMessageService.removeReaction.mockResolvedValueOnce([]);

        const res = await fetch(`${baseUrl}/trips/${encoded}/messages/msg1/reactions`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json", "x-user-token": "tok-alice" },
            body: JSON.stringify({ emoji: "\u{1F44D}" }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.reactions).toEqual([]);
        expect(mockMessageService.removeReaction).toHaveBeenCalledWith("trip123", "msg1", "member1", "\u{1F44D}");
    });
});