import { CallRoutingService } from "./call-routing.service";

describe("CallRoutingService", () => {
  it("invalidates released or reassigned numbers so the next call does not use stale routing", async () => {
    const deps = createDependencies();
    deps.phoneNumbers.findRoutableByPhoneNumber
      .mockResolvedValueOnce(routeFixture("agent-a"))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(routeFixture("agent-b"));
    const service = new CallRoutingService(
      deps.phoneNumbers as never,
      deps.config as never,
      deps.metrics as never,
    );

    await expect(service.resolve("+1 (416) 555-9876")).resolves.toMatchObject({
      agentId: "agent-a",
    });

    service.invalidate("+14165559876");
    await expect(service.resolve("+14165559876")).resolves.toBeNull();

    service.invalidate("+14165559876");
    await expect(service.resolve("+14165559876")).resolves.toMatchObject({
      agentId: "agent-b",
      agent: { id: "agent-b" },
    });

    expect(deps.phoneNumbers.findRoutableByPhoneNumber).toHaveBeenCalledTimes(3);
  });
});

function createDependencies() {
  return {
    phoneNumbers: {
      findRoutableByPhoneNumber: jest.fn(),
    },
    config: {
      get: jest.fn().mockReturnValue(30_000),
    },
    metrics: {
      increment: jest.fn(),
    },
  };
}

function routeFixture(agentId: string) {
  return {
    id: "phone-1",
    organizationId: "org-1",
    agentId,
    phoneNumber: "+14165559876",
    agent: { id: agentId, name: "Agent", status: "ACTIVE", language: "English" },
  };
}
