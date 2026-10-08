import { jest } from "@jest/globals";

const mockGetLinkPreview = jest.fn();
jest.unstable_mockModule("link-preview-js", () => ({ getLinkPreview: mockGetLinkPreview }));

const mockLookup = jest.fn();
jest.unstable_mockModule("node:dns", () => ({ default: { lookup: mockLookup } }));

const { getPreview, isPrivateAddress, isSameSiteRedirect } = await import("./linkPreviewService.mjs");
const { InvalidError, ForbiddenError } = await import("../utils/errors.mjs");

const publicLookup = (hostname, cb) => cb(null, "93.184.216.34", 4);

beforeEach(() => {
    jest.clearAllMocks();
    mockLookup.mockImplementation(publicLookup);
});

const fullPreview = (overrides = {}) => ({
    url: "https://example.com/page",
    title: "Le bon plan",
    description: "Une super page",
    images: ["https://img.example.com/a.jpg"],
    favicons: ["https://img.example.com/favicon.ico"],
    ...overrides,
});

describe("isPrivateAddress — SSRF ranges", () => {
    test.each([
        ["127.0.0.1", true],
        ["10.1.2.3", true],
        ["172.16.0.1", true],
        ["172.31.255.255", true],
        ["192.168.1.1", true],
        ["169.254.169.254", true],
        ["100.64.0.1", true],
        ["198.18.0.1", true],
        ["224.0.0.1", true],
        ["::1", true],
        ["fe80::1", true],
        ["fd12::1", true],
        ["::ffff:192.168.0.1", true],
        ["8.8.8.8", false],
        ["172.32.0.1", false],
        ["93.184.216.34", false],
        ["2606:4700::1111", false, 6],
    ])("%s → %p", (address, expected, family = 4) => {
        expect(isPrivateAddress(address, family)).toBe(expected);
    });
});

describe("isSameSiteRedirect — redirect policy", () => {
    test("allows https redirects to the same host", () => {
        expect(isSameSiteRedirect("https://booking.com/x", "https://booking.com/y")).toBe(true);
    });

    test("allows https www variants in both directions", () => {
        expect(isSameSiteRedirect("https://booking.com/x", "https://www.booking.com/y")).toBe(true);
        expect(isSameSiteRedirect("https://www.booking.com/x", "https://booking.com/y")).toBe(true);
    });

    test("allows https redirects to subdomains of the base host (fr.booking.com, secure.booking.com)", () => {
        expect(isSameSiteRedirect("https://booking.com/x", "https://fr.booking.com/y")).toBe(true);
        expect(isSameSiteRedirect("https://www.booking.com/x", "https://secure.booking.com/y")).toBe(true);
    });

    test("rejects https to http downgrades, even on the same host", () => {
        expect(isSameSiteRedirect("https://booking.com/x", "http://booking.com/y")).toBe(false);
        expect(isSameSiteRedirect("https://booking.com/x", "http://www.booking.com/y")).toBe(false);
    });

    test("rejects https redirects to other domains", () => {
        expect(isSameSiteRedirect("https://booking.com/x", "https://evil-booking.com/y")).toBe(false);
        expect(isSameSiteRedirect("https://booking.com/x", "https://attacker.com/y")).toBe(false);
    });
});
describe("getPreview", () => {
    test("returns the preview on the first attempt", async () => {
        mockGetLinkPreview.mockResolvedValueOnce(fullPreview());

        const result = await getPreview("https://example.com/page");

        expect(result).toEqual({
            success: true,
            data: {
                url: "https://example.com/page",
                title: "Le bon plan",
                description: "Une super page",
                image: "https://img.example.com/a.jpg",
                icon: "https://img.example.com/favicon.ico",
                fallback: false,
            },
        });
        expect(mockGetLinkPreview).toHaveBeenCalledTimes(1);
        expect(mockGetLinkPreview.mock.calls[0][1].headers["user-agent"]).toMatch(/Chrome/);
    });

    test("retries with the second browser profile when the first is bot-blocked (booking.com)", async () => {
        mockGetLinkPreview
            .mockResolvedValueOnce(fullPreview({ title: "Just a moment..." }))
            .mockResolvedValueOnce(fullPreview({ title: "Hôtel Le Cosy — Booking.com" }));

        const result = await getPreview("https://www.booking.com/hotel/fr/le-cosy");

        expect(result.data.title).toBe("Hôtel Le Cosy — Booking.com");
        expect(result.data.fallback).toBe(false);
        expect(mockGetLinkPreview).toHaveBeenCalledTimes(2);
        expect(mockGetLinkPreview.mock.calls[0][1].headers["user-agent"]).toMatch(/Chrome/);
        expect(mockGetLinkPreview.mock.calls[1][1].headers["user-agent"]).toMatch(/Safari/);
    });

    test("degrades to a domain fallback card when every attempt bounces", async () => {
        mockGetLinkPreview
            .mockResolvedValueOnce(fullPreview({ title: "Attention Required! | Cloudflare" }))
            .mockResolvedValueOnce(fullPreview({ title: "Sorry, you have been blocked" }));

        const result = await getPreview("https://www.booking.com/hotel/fr/le-cosy");

        expect(result.success).toBe(true);
        expect(result.data).toEqual({
            url: "https://www.booking.com/hotel/fr/le-cosy",
            title: "booking.com",
            description: null,
            image: null,
            icon: null,
            fallback: true,
        });
    });

    test("rejects non-https URLs (422)", async () => {
        await expect(getPreview("http://example.com/page")).rejects.toThrow(InvalidError);
        expect(mockGetLinkPreview).not.toHaveBeenCalled();
    });

    test("rejects malformed URLs (422)", async () => {
        await expect(getPreview("not a url")).rejects.toThrow(InvalidError);
    });

    test("rejects hosts resolving to private addresses — SSRF guard (403)", async () => {
        mockLookup.mockImplementation((hostname, cb) => cb(null, "10.0.0.8", 4));

        await expect(getPreview("https://internal.example.com")).rejects.toThrow(ForbiddenError);
        expect(mockGetLinkPreview).not.toHaveBeenCalled();
    });

    test("rejects unresolvable hosts (422)", async () => {
        mockLookup.mockImplementation((hostname, cb) => cb(new Error("ENOTFOUND")));

        await expect(getPreview("https://does-not-exist.example.com")).rejects.toThrow(InvalidError);
    });
});