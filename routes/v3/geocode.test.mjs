import { jest } from "@jest/globals";

const mockGeocodingService = {
    geocode: jest.fn(),
};

jest.unstable_mockModule("../../services/geocoding/index.mjs", () => mockGeocodingService);

let app, server, baseUrl;

beforeAll(async () => {
    const express = (await import("express")).default;
    const { handleError } = await import("../../middlewares/errorMiddleware.mjs");
    const geocode = (await import("./geocode.mjs")).default;

    app = express();
    app.use(express.json());
    app.use(geocode);
    app.use(handleError);

    server = app.listen(0);
    baseUrl = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
    await new Promise((r) => server.close(r));
});

describe("POST /geocode (v3)", () => {
    const validBody = { address: "12 rue de la Paix, Paris" };

    test("delegates to the service and wraps the result (200)", async () => {
        mockGeocodingService.geocode.mockResolvedValueOnce([
            {
                coordinates: [2.3316, 48.8676],
                displayName: "12 Rue de la Paix, 75002 Paris, France",
                provider: "mapbox",
            },
            {
                coordinates: [-1.5536, 47.2184],
                displayName: "Rue de la Paix, 44000 Nantes, France",
                provider: "mapbox",
            },
        ]);

        const res = await fetch(`${baseUrl}/geocode`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(validBody),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toEqual({
            success: true,
            data: [
                {
                    coordinates: [2.3316, 48.8676],
                    displayName: "12 Rue de la Paix, 75002 Paris, France",
                    provider: "mapbox",
                },
                {
                    coordinates: [-1.5536, 47.2184],
                    displayName: "Rue de la Paix, 44000 Nantes, France",
                    provider: "mapbox",
                },
            ],
        });
        expect(mockGeocodingService.geocode).toHaveBeenCalledWith("12 rue de la Paix, Paris");
    });

    test("surfaces invalid addresses as 422 via the error middleware", async () => {
        const { InvalidError } = await import("../../utils/errors.mjs");
        mockGeocodingService.geocode.mockRejectedValueOnce(new InvalidError("Missing or empty address"));

        const res = await fetch(`${baseUrl}/geocode`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });

        expect(res.status).toBe(422);
        const body = await res.json();
        expect(body.message).toBe("Missing or empty address");
    });

    test("surfaces in-flight saturation as 503 via the error middleware", async () => {
        const { ServiceUnavailableError } = await import("../../utils/errors.mjs");
        mockGeocodingService.geocode.mockRejectedValueOnce(new ServiceUnavailableError("Geocoding is under heavy load, please retry shortly"));

        const res = await fetch(`${baseUrl}/geocode`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(validBody),
        });

        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.message).toBe("Geocoding is under heavy load, please retry shortly");
    });

    test("returns a generic 500 on unexpected provider errors", async () => {
        mockGeocodingService.geocode.mockRejectedValueOnce(new Error("Mapbox request failed: timeout"));

        const res = await fetch(`${baseUrl}/geocode`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(validBody),
        });

        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.message).toBe("Internal server error");
    });
});
