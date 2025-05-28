import { getActivities } from "./activitiesService.mjs";

describe("Validate getActivities function", () => {
  it("Should return list of activities with users", async () => {
    const results = await getActivities({ params: { id: 1 } });

    expect(results).toBeDefined();
    
  });
});
