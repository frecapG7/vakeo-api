import { requireMembership, requireReadAccess, verifyUser } from "./validationService.mjs";
import { ForbiddenError } from "../utils/errors.mjs";


const trip = (userIds) => ({
    _id: "trip1",
    users: userIds.map(id => ({ toString: () => id })),
});

const privateTrip = (userIds) => ({
    _id: "trip1",
    isPrivate: true,
    users: userIds.map(id => ({ toString: () => id })),
});

const publicTrip = (userIds) => ({
    _id: "trip1",
    isPrivate: false,
    users: userIds.map(id => ({ toString: () => id })),
});

const user = (id) => ({ _id: { toString: () => id } });


describe("requireMembership", () => {

    test("passes when user is a member of the trip", () => {
        expect(() => requireMembership(trip(["u1", "u2"]), user("u1"))).not.toThrow();
    });

    test("throws ForbiddenError when user is not a member", () => {
        expect(() => requireMembership(trip(["u1", "u2"]), user("u3")))
            .toThrow(ForbiddenError);
    });

    test("throws ForbiddenError when user is null/anonymous", () => {
        expect(() => requireMembership(trip(["u1"]), null))
            .toThrow(ForbiddenError);
    });

    test("throws ForbiddenError when user is undefined", () => {
        expect(() => requireMembership(trip(["u1"]), undefined))
            .toThrow(ForbiddenError);
    });

    test("throws ForbiddenError when user has no _id", () => {
        expect(() => requireMembership(trip(["u1"]), {}))
            .toThrow(ForbiddenError);
    });

    test("error message for non-member mentions the user id", () => {
        try {
            requireMembership(trip(["u1"]), user("u9"));
        } catch (err) {
            expect(err.message).toContain("u9");
            expect(err.statusCode).toBe(403);
        }
    });

    test("error message for anonymous says authentication required", () => {
        try {
            requireMembership(trip(["u1"]), null);
        } catch (err) {
            expect(err.message).toContain("Authentication required");
            expect(err.statusCode).toBe(403);
        }
    });
});


describe("verifyUser (back-compat alias)", () => {

    test("still passes for a member", () => {
        expect(() => verifyUser(trip(["u1", "u2"]), user("u1"))).not.toThrow();
    });

    test("still throws for a non-member", () => {
        expect(() => verifyUser(trip(["u1"]), user("u3")))
            .toThrow(ForbiddenError);
    });
});


describe("requireReadAccess", () => {

    test("public trip: anyone can read (anonymous OK)", () => {
        expect(() => requireReadAccess(publicTrip(["u1"]), null)).not.toThrow();
    });

    test("public trip: non-member can read", () => {
        expect(() => requireReadAccess(publicTrip(["u1"]), user("u3"))).not.toThrow();
    });

    test("public trip: member can read", () => {
        expect(() => requireReadAccess(publicTrip(["u1"]), user("u1"))).not.toThrow();
    });

    test("private trip: anonymous gets 403", () => {
        expect(() => requireReadAccess(privateTrip(["u1"]), null))
            .toThrow(ForbiddenError);
    });

    test("private trip: non-member gets 403", () => {
        expect(() => requireReadAccess(privateTrip(["u1"]), user("u3")))
            .toThrow(ForbiddenError);
    });

    test("private trip: member can read", () => {
        expect(() => requireReadAccess(privateTrip(["u1", "u2"]), user("u1"))).not.toThrow();
    });
});
