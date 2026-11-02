import { geocode as nominatimGeocode } from "./nominatim.mjs";
import { geocode as mapboxGeocode } from "./mapbox.mjs";
import { InvalidError } from "../../utils/errors.mjs";


const MAX_ADDRESS_LENGTH = 300;

// Providers answer the same query over and over (same stops searched by
// different members) and bill by the request: a small TTL cache absorbs
// the repeats without a store. In-flight calls are deduplicated so a
// burst of identical requests only hits the provider once.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

const cache = new Map();
const inFlight = new Map();

let provider = mapboxGeocode;


export const setGeocodingProvider = (name) => {
    provider = name === "nominatim" ? nominatimGeocode : mapboxGeocode;
}


const cacheResult = (key, result) => {
    if (!Array.isArray(result.coordinates) || result.coordinates.length === 0)
        return;

    if (cache.size >= CACHE_MAX_ENTRIES) {
        const now = Date.now();
        for (const [k, entry] of cache) {
            if (entry.expiresAt <= now)
                cache.delete(k);
        }
        while (cache.size >= CACHE_MAX_ENTRIES)
            cache.delete(cache.keys().next().value);
    }

    cache.set(key, {
        value: result,
        expiresAt: Date.now() + CACHE_TTL_MS,
    });
}


export const geocode = async (address) => {
    if (typeof address !== "string" || address.trim().length === 0)
        throw new InvalidError("Missing or empty address");
    if (address.trim().length > MAX_ADDRESS_LENGTH)
        throw new InvalidError(`Address must be at most ${MAX_ADDRESS_LENGTH} characters`);

    const normalized = address.trim();

    const cached = cache.get(normalized);
    if (cached && cached.expiresAt > Date.now())
        return cached.value;

    const pending = inFlight.get(normalized);
    if (pending)
        return pending;

    const promise = provider(normalized)
        .then((result) => {
            cacheResult(normalized, result);
            return result;
        });

    inFlight.set(normalized, promise);
    try {
        return await promise;
    } finally {
        inFlight.delete(normalized);
    }
}
