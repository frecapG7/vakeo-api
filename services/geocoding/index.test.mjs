import { jest } from "@jest/globals";
import { geocode, setGeocodingProvider } from "./index.mjs";


const mapboxResponse = (features) => ({
    ok: true,
    json: async () => ({ features }),
});


beforeAll(() => {
    process.env.MAPBOX_ACCESS_TOKEN = "pk.test-token";
});

afterEach(() => {
    setGeocodingProvider("mapbox");
    jest.restoreAllMocks();
});


describe("geocode (validation)", () => {
    test.each([undefined, "", "   ", 42])("rejects a missing or non-string address (%p)", async (address) => {
        await expect(geocode(address)).rejects.toMatchObject({
            name: "InvalidError",
            statusCode: 422,
        });
    });

    test("rejects an address longer than 300 characters", async () => {
        await expect(geocode("a".repeat(301))).rejects.toMatchObject({
            name: "InvalidError",
            statusCode: 422,
        });
    });
});


describe("geocode (mapbox provider, default)", () => {
    test("resolves an address to coordinates", async () => {
        const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            mapboxResponse([
                {
                    geometry: { coordinates: [2.3522, 48.8566] },
                    properties: { full_address: "Paris, France" },
                },
            ])
        );

        const result = await geocode("  Paris  ");

        expect(result).toEqual({
            coordinates: [2.3522, 48.8566],
            displayName: "Paris, France",
            provider: "mapbox",
        });

        const url = new URL(fetchMock.mock.calls[0][0]);
        expect(url.origin + url.pathname).toBe("https://api.mapbox.com/search/geocode/v6/forward");
        expect(url.searchParams.get("q")).toBe("Paris");
        expect(url.searchParams.get("access_token")).toBe("pk.test-token");
        expect(url.searchParams.get("limit")).toBe("1");
    });

    test("returns empty coordinates when the provider finds nothing", async () => {
        jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(mapboxResponse([]));

        const result = await geocode("zzzz-not-a-place-qwerty");

        expect(result).toEqual({
            coordinates: [],
            displayName: "No results",
            provider: "mapbox",
        });
    });

    test("surfaces provider HTTP failures", async () => {
        jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
            ok: false,
            status: 500,
        });

        await expect(geocode("Lyon")).rejects.toThrow("Mapbox request failed with status 500");
    });

    test("surfaces network failures", async () => {
        jest.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("timeout"));

        await expect(geocode("Marseille")).rejects.toThrow("Mapbox request failed: timeout");
    });

    test("refuses to call the provider without a token", async () => {
        const fetchMock = jest.spyOn(globalThis, "fetch");
        delete process.env.MAPBOX_ACCESS_TOKEN;

        await expect(geocode("Bordeaux")).rejects.toThrow("MAPBOX_ACCESS_TOKEN is not configured");
        expect(fetchMock).not.toHaveBeenCalled();

        process.env.MAPBOX_ACCESS_TOKEN = "pk.test-token";
    });

    test("serves a repeated address from the cache without a second provider call", async () => {
        const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
            mapboxResponse([
                {
                    geometry: { coordinates: [-1.5536, 47.2184] },
                    properties: { full_address: "Nantes, France" },
                },
            ])
        );

        const first = await geocode("Nantes");
        const second = await geocode("Nantes");

        expect(second).toEqual(first);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test("deduplicates concurrent calls for the same address", async () => {
        const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
            mapboxResponse([
                {
                    geometry: { coordinates: [-4.4869, 48.3904] },
                    properties: { full_address: "Brest, France" },
                },
            ])
        );

        const [first, second] = await Promise.all([
            geocode("Brest"),
            geocode("Brest"),
        ]);

        expect(first).toEqual(second);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test("does not cache empty results", async () => {
        const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(mapboxResponse([]));

        await geocode("Toulouse");
        await geocode("Toulouse");

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});


describe("geocode (nominatim provider, opt-in)", () => {
    test("still works when selected explicitly", async () => {
        setGeocodingProvider("nominatim");
        jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
            ok: true,
            json: async () => [{ lat: "48.1119", lon: "-1.6805", display_name: "Rennes, France" }],
        });

        const result = await geocode("Rennes");

        expect(result).toEqual({
            coordinates: [-1.6805, 48.1119],
            displayName: "Rennes, France",
            provider: "nominatim",
        });
    });
});
