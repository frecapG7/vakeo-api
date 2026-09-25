import TripUser from "../models/tripUserModel.mjs";
import { buildTripUser } from "./tripUserService.mjs";


describe("TripUser token — model & service (seat model)", () => {

    test("schema has token field with select:false and partial unique index", () => {
        const tokenPath = TripUser.schema.path("token");
        expect(tokenPath).toBeDefined();
        expect(tokenPath.options.select).toBe(false);
        expect(tokenPath.options.index.unique).toBe(true);
        expect(tokenPath.options.index.partialFilterExpression).toEqual({ token: { $type: "string" } });
    });

    test("schema has no default for token (seats start free)", () => {
        const tokenPath = TripUser.schema.path("token");
        expect(tokenPath.options.default).toBeUndefined();
    });

    test("buildTripUser creates a seat with NO token (free seat)", () => {
        const user = buildTripUser({ name: "Alice", avatar: "img" });
        expect(user.name).toBe("Alice");
        expect(user.avatar).toBe("img");
        expect(user.token).toBeUndefined();
    });

    test("explicit token on construction is preserved", () => {
        const user = new TripUser({ name: "Carol", token: "explicit-token-value" });
        expect(user.token).toBe("explicit-token-value");
    });

    test("buildTripUser preserves name and avatar", () => {
        const user = buildTripUser({ name: "Bob", avatar: "pic" });
        expect(user.name).toBe("Bob");
        expect(user.avatar).toBe("pic");
    });
});


/**
 * The following functions require a live MongoDB connection and are
 * verified via syntax check + manual/integration testing, not unit tests:
 *   - getTripUserByToken(token)  → findOne({ token }).select("+token")
 *   - rotateTripUserToken(id)    → findByIdAndUpdate with new random token
 *   - claimSeat(tripUserId)     → atomic findOneAndUpdate({ token: null })
 *   - releaseSeat(tripUserId)    → $unset token (seat goes back to free)
 */
