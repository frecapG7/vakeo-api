import { jest } from "@jest/globals";
import { geocode, setGeocodingProvider, MAX_IN_FLIGHT } from "./index.mjs";


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

        expect(result).toEqual([
            {
                coordinates: [2.3522, 48.8566],
                displayName: "Paris, France",
                provider: "mapbox",
            },
        ]);

        const url = new URL(fetchMock.mock.calls[0][0]);
        expect(url.origin + url.pathname).toBe("https://api.mapbox.com/search/geocode/v6/forward");
        expect(url.searchParams.get("q")).toBe("Paris");
        expect(url.searchParams.get("access_token")).toBe("pk.test-token");
        expect(url.searchParams.get("limit")).toBe("5");
    });

    test("maps the ranked features in order", async () => {
        jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            mapboxResponse([
                { geometry: { coordinates: [1.4434, 43.6047] }, properties: { full_address: "Toulouse, France" } },
                { geometry: { coordinates: [1.4478, 43.6006] }, properties: { full_address: "Toulouse, 31000 Toulouse, France" } },
            ])
        );

        const result = await geocode("Foix");

        expect(result).toEqual([
            { coordinates: [1.4434, 43.6047], displayName: "Toulouse, France", provider: "mapbox" },
            { coordinates: [1.4478, 43.6006], displayName: "Toulouse, 31000 Toulouse, France", provider: "mapbox" },
        ]);
    });

    test("drops matches without usable coordinates", async () => {
        jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            mapboxResponse([
                { properties: { full_address: "No Geometry, Void" } },
                { geometry: {}, properties: { full_address: "Empty Geometry, Void" } },
                { geometry: { coordinates: [-1.5536, 47.2184] }, properties: { full_address: "Nantes, France" } },
            ])
        );

        const result = await geocode("Narnia");

        expect(result).toEqual([
            { coordinates: [-1.5536, 47.2184], displayName: "Nantes, France", provider: "mapbox" },
        ]);
    });

    test("returns an empty list when the provider finds nothing", async () => {
        jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(mapboxResponse([]));

        const result = await geocode("zzzz-not-a-place-qwerty");

        expect(result).toEqual([]);
    });

    test("returns an empty list when the payload features field is not an array", async () => {
        jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
            ok: true,
            json: async () => ({ features: "unexpected" }),
        });

        const result = await geocode("Paradise City");

        expect(result).toEqual([]);
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

    test("caps the list at five matches even if the provider returns more", async () => {
        jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            mapboxResponse(
                Array.from({ length: 7 }, (_, i) => ({
                    geometry: { coordinates: [i, i] },
                    properties: { full_address: `Candidate ${i}, Void` },
                }))
            )
        );

        const result = await geocode("Ratatouille");

        expect(result).toHaveLength(5);
        expect(result.map((item) => item.displayName)).toEqual([
            "Candidate 0, Void",
            "Candidate 1, Void",
            "Candidate 2, Void",
            "Candidate 3, Void",
            "Candidate 4, Void",
        ]);
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

        expect(result).toEqual([
            {
                coordinates: [-1.6805, 48.1119],
                displayName: "Rennes, France",
                provider: "nominatim",
            },
        ]);
    });

    test("drops unusable matches and caps the list at five", async () => {
        setGeocodingProvider("nominatim");
        const entry = (i) => ({ lat: "48.1119", lon: "-1.6805", display_name: `Ville ${i}, France` });
        jest.spyOn(globalThis, "fetch").mockResolvedValueOnce({
            ok: true,
            json: async () => [
                entry(0),
                { lat: "broken", lon: "-1.6805", display_name: "NaN, Void" },
                entry(1),
                entry(2),
                entry(3),
                entry(4),
                entry(5),
                entry(6),
            ],
        });

        const result = await geocode("Rennes-ish");

        expect(result).toEqual([
            { coordinates: [-1.6805, 48.1119], displayName: "Ville 0, France", provider: "nominatim" },
            { coordinates: [-1.6805, 48.1119], displayName: "Ville 1, France", provider: "nominatim" },
            { coordinates: [-1.6805, 48.1119], displayName: "Ville 2, France", provider: "nominatim" },
            { coordinates: [-1.6805, 48.1119], displayName: "Ville 3, France", provider: "nominatim" },
            { coordinates: [-1.6805, 48.1119], displayName: "Ville 4, France", provider: "nominatim" },
        ]);
    });
});

describe("geocode (in-flight cap)", () => {
    test("rejects unique addresses beyond the cap with 503 without extra provider calls", async () => {
        let release;
        const gate = new Promise((resolve) => { release = resolve; });
        const fetchMock = jest.spyOn(globalThis, "fetch").mockImplementation(
            () => gate.then(() => mapboxResponse([]))
        );

        const calls = Array.from({ length: MAX_IN_FLIGHT + 5 }, (_, i) => {
            const call = geocode(`flood-${i}`);
            call.catch(() => {});
            return call;
        });
        release();

        const settled = await Promise.allSettled(calls);
        const rejected = settled.filter((entry) => entry.status === "rejected");

        expect(rejected).toHaveLength(5);
        for (const entry of rejected)
            expect(entry.reason).toMatchObject({ name: "ServiceUnavailableError", statusCode: 503 });
        expect(fetchMock).toHaveBeenCalledTimes(MAX_IN_FLIGHT);
    });

    test("still deduplicates an already in-flight address at the cap", async () => {
        let release;
        const gate = new Promise((resolve) => { release = resolve; });
        const fetchMock = jest.spyOn(globalThis, "fetch").mockImplementation(
            () => gate.then(() => mapboxResponse([]))
        );

        const filler = Array.from({ length: MAX_IN_FLIGHT }, (_, i) => {
            const call = geocode(`saturation-${i}`);
            call.catch(() => {});
            return call;
        });
        const joiner = geocode("saturation-0");
        joiner.catch(() => {});
        release();

        const settled = await Promise.allSettled([...filler, joiner]);

        expect(settled.every((entry) => entry.status === "fulfilled")).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(MAX_IN_FLIGHT);
    });
});
