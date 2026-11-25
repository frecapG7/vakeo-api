import { jest } from "@jest/globals";

const mockReportMessageAnonymously = jest.fn();

jest.unstable_mockModule("../../services/messageReportService.mjs", () => ({
    reportMessageAnonymously: mockReportMessageAnonymously,
}));

let server;
let baseUrl;

beforeAll(async () => {
    const express = (await import("express")).default;
    const { handleError } = await import("../../middlewares/errorMiddleware.mjs");
    const messageReports = (await import("./messageReports.mjs")).default;

    const app = express();
    app.use(express.json());
    app.use(messageReports);
    app.use(handleError);

    server = app.listen(0);
    baseUrl = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
    await new Promise((r) => server.close(r));
});

const report = (body) => fetch(`${baseUrl}/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
});

/**
 * The public channel is unauthenticated: the per-IP limit is the only defence
 * against a report flood. Kept in its own file, in a single test, because the
 * limiter state belongs to the router instance — spreading calls across tests
 * would make the threshold depend on execution order.
 *
 * Delegation and status mapping (202 receipt, 422 invalid payload) are covered
 * in sub-resources.test.mjs; the uniform 202 on an unknown message id is
 * covered in messageReportService.flows.test.mjs.
 */
describe("v3 public message reports — per-IP limit", () => {
    test("accepts 5 reports per minute from one IP, then refuses", async () => {
        mockReportMessageAnonymously.mockResolvedValue({ received: true });

        let accepted = 0;
        let lastStatus = 0;
        for (let i = 0; i < 10; i++) {
            const res = await report({ messageId: "6511111111111111111111a1", reason: "spam" });
            lastStatus = res.status;
            if (lastStatus !== 202) break;
            accepted++;
        }

        expect(accepted).toBe(5);
        expect(lastStatus).toBe(429);
        expect(mockReportMessageAnonymously).toHaveBeenCalledTimes(5);
    });
});
