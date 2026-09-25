import { encodeId, decodeId, resolveEncodedTripId } from "./idEncoderService.mjs";
import { InvalidError } from "../utils/errors.mjs";


describe("resolveEncodedTripId", () => {

    test("round-trips an encoded id back to the original", () => {
        const original = "507f1f77bcf86cd799439011";
        const encoded = encodeId(original);
        const resolved = resolveEncodedTripId(encoded);
        expect(resolved).toBe(original);
    });

    test("decodeId also round-trips (low-level)", () => {
        const original = "abc123tripId";
        expect(decodeId(encodeId(original))).toBe(original);
    });

    test("each encoding is unique (random iv)", () => {
        const id = "507f1f77bcf86cd799439011";
        expect(encodeId(id)).not.toBe(encodeId(id));
    });

    test("prints an encoded id you can use for manual v3 testing", () => {
        const ids = [
            "507f1f77bcf86cd799439011",
            "507f1f77bcf86cd799439012",
            "507f1f77bcf86cd799439013",
        ];
        for (const id of ids) {
            const encoded = encodeId(id);
            console.log(`\n  raw: ${id}\n  encoded: ${encoded}\n  round-trip: ${decodeId(encoded) === id}`);
            expect(decodeId(encoded)).toBe(id);
        }
    });

    test("throws InvalidError on tampered ciphertext", () => {
        const encoded = encodeId("507f1f77bcf86cd799439011");
        const tampered = encoded.slice(0, -2) + "AA";
        expect(() => resolveEncodedTripId(tampered)).toThrow(InvalidError);
    });

    test("throws InvalidError on garbage input", () => {
        expect(() => resolveEncodedTripId("not-a-valid-encoded-id"))
            .toThrow(InvalidError);
    });

    test("throws InvalidError on empty input", () => {
        expect(() => resolveEncodedTripId("")).toThrow(InvalidError);
    });

    test("error has statusCode 422, not 500", () => {
        try {
            resolveEncodedTripId("garbage");
        } catch (err) {
            expect(err.statusCode).toBe(422);
            expect(err.name).toBe("InvalidError");
        }
    });
});
