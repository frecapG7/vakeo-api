import { generateJoinToken, verifyJoinToken } from "./joinTokenService.mjs";
import { ForbiddenError } from "../utils/errors.mjs";


describe("joinTokenService", () => {

    test("generate + verify round-trips for the correct trip", async () => {
        const token = await generateJoinToken("trip123");
        const payload = await verifyJoinToken(token, "trip123");
        expect(payload.sub).toBe("trip123");
        expect(payload.role).toBe("join");
    });

    test("rejects when sub does not match expected trip id", async () => {
        const token = await generateJoinToken("trip123");
        await expect(verifyJoinToken(token, "trip456"))
            .rejects.toThrow(ForbiddenError);
    });

    test("rejects a tampered token", async () => {
        const token = await generateJoinToken("trip123");
        const tampered = token.slice(0, -4) + "AAAA";
        await expect(verifyJoinToken(tampered, "trip123"))
            .rejects.toThrow(ForbiddenError);
    });

    test("rejects an expired token", async () => {
        const token = await generateJoinToken("trip123", "1s");
        await new Promise((r) => setTimeout(r, 1100));
        await expect(verifyJoinToken(token, "trip123"))
            .rejects.toThrow(ForbiddenError);
    });

    test("rejects garbage input", async () => {
        await expect(verifyJoinToken("not-a-jwt", "trip123"))
            .rejects.toThrow(ForbiddenError);
    });
});
