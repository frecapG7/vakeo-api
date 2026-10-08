import { jest } from "@jest/globals";

const mockLinkPreviewService = {
    getPreview: jest.fn(),
};

jest.unstable_mockModule("../../services/linkPreviewService.mjs", () => mockLinkPreviewService);

let app, server, baseUrl;

beforeAll(async () => {
    const express = (await import("express")).default;
    const { handleError } = await import("../../middlewares/errorMiddleware.mjs");
    const linkPreview = (await import("./linkPreview.mjs")).default;

    app = express();
    app.use(express.json());
    app.use(linkPreview);
    app.use(handleError);

    server = app.listen(0);
    baseUrl = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
    await new Promise((r) => server.close(r));
});

describe("POST /link-preview (v3)", () => {
    const validBody = { url: "https://example.com/page" };

    test("delegates to the service and returns the card (200)", async () => {
        mockLinkPreviewService.getPreview.mockResolvedValueOnce({
            success: true,
            data: {
                url: "https://example.com/page",
                title: "Le bon plan",
                description: null,
                image: null,
                icon: null,
                fallback: false,
            },
        });

        const res = await fetch(`${baseUrl}/link-preview`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(validBody),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.title).toBe("Le bon plan");
        expect(mockLinkPreviewService.getPreview).toHaveBeenCalledWith("https://example.com/page");
    });

    test("surfaces invalid URLs as 422 via the error middleware", async () => {
        const { InvalidError } = await import("../../utils/errors.mjs");
        mockLinkPreviewService.getPreview.mockRejectedValueOnce(new InvalidError("Invalid url"));

        const res = await fetch(`${baseUrl}/link-preview`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: "not a url" }),
        });

        expect(res.status).toBe(422);
        const body = await res.json();
        expect(body.message).toBe("Invalid url");
    });

    test("surfaces private-address targets as 403 (SSRF guard)", async () => {
        const { ForbiddenError } = await import("../../utils/errors.mjs");
        mockLinkPreviewService.getPreview.mockRejectedValueOnce(
            new ForbiddenError("URL resolves to a private address")
        );

        const res = await fetch(`${baseUrl}/link-preview`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: "https://internal.example.com" }),
        });

        expect(res.status).toBe(403);
    });
});