import { ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { WidgetPositionDto, WidgetStatusDto } from "./dto/widget.dto";
import { WidgetService } from "./widget.service";

const context = {
  userId: "user-1",
  organizationId: "org-1",
  email: "owner@example.com",
  role: "OWNER" as const,
};

describe("WidgetService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates tenant-scoped widgets for owned agents", async () => {
    const deps = createDependencies();
    deps.widgets.agentExists.mockResolvedValue({ id: "agent-1", name: "Support" });
    deps.widgets.create.mockResolvedValue(widgetFixture());
    const service = createService(deps);

    const result = await service.create(context, {
      name: "Website Chat",
      agentId: "agent-1",
      status: WidgetStatusDto.ACTIVE,
      position: WidgetPositionDto.BOTTOM_RIGHT,
      primaryColor: "#0f766e",
      welcomeMessage: "Hi",
    });

    expect(deps.widgets.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        agentId: "agent-1",
        publicKey: expect.stringMatching(/^wpk_/),
      }),
    );
    expect(result.name).toBe("Website Chat");
  });

  it("rejects widget creation for agents outside the tenant", async () => {
    const deps = createDependencies();
    deps.widgets.agentExists.mockResolvedValue(null);
    const service = createService(deps);

    await expect(
      service.create(context, {
        name: "Website Chat",
        agentId: "agent-1",
        status: WidgetStatusDto.ACTIVE,
        position: WidgetPositionDto.BOTTOM_RIGHT,
        primaryColor: "#0f766e",
        welcomeMessage: "Hi",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("creates or continues visitor conversations for valid public widgets", async () => {
    const deps = createDependencies();
    deps.widgets.findPublicCandidate.mockResolvedValue(widgetFixture());
    deps.widgets.conversationForVisitor.mockResolvedValue(null);
    deps.widgets.createConversation.mockResolvedValue(conversationFixture());
    const service = createService(deps);

    const result = await service.createVisitorConversation(
      { widgetId: "widget-1", publicKey: "wpk_public" },
      { ip: "127.0.0.1", userAgent: "jest" },
    );

    expect(deps.widgets.upsertVisitor).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        widgetId: "widget-1",
        visitorId: expect.any(String),
        ipHash: expect.any(String),
        userAgent: "jest",
      }),
    );
    expect(result.conversationId).toBe("conversation-1");
    expect(result.conversation.source).toBe("WIDGET");
    expect(deps.rateLimits.assertAllowed).toHaveBeenCalledWith({
      widgetId: "widget-1",
      action: "conversation",
      ip: "127.0.0.1",
      visitorId: undefined,
    });
  });

  it("sends public widget messages through the existing response engine", async () => {
    const deps = createDependencies();
    deps.widgets.findPublicCandidate.mockResolvedValue(widgetFixture());
    deps.widgets.conversationForVisitor.mockResolvedValue(conversationFixture());
    deps.responses.send.mockResolvedValue({
      assistantMessage: { id: "assistant-1" },
      responseTime: 42,
    });
    const service = createService(deps);

    const result = await service.sendMessage(
      {
        widgetId: "widget-1",
        publicKey: "wpk_public",
        visitorId: "visitor-1",
        conversationId: "conversation-1",
        message: "Hello",
      },
      { ip: "127.0.0.1", userAgent: "jest" },
    );

    expect(deps.responses.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "public-widget",
        organizationId: "org-1",
      }),
      {
        agentId: "agent-1",
        conversationId: "conversation-1",
        message: "Hello",
        source: "WIDGET",
      },
    );
    expect(result.responseTime).toBe(42);
    expect(deps.rateLimits.assertAllowed).toHaveBeenCalledWith({
      widgetId: "widget-1",
      action: "chat",
      ip: "127.0.0.1",
      visitorId: "visitor-1",
    });
  });

  it("blocks public chat when the visitor conversation does not match the widget", async () => {
    const deps = createDependencies();
    deps.widgets.findPublicCandidate.mockResolvedValue(widgetFixture());
    deps.widgets.conversationForVisitor.mockResolvedValue(null);
    const service = createService(deps);

    await expect(
      service.sendMessage(
        {
          widgetId: "widget-1",
          publicKey: "wpk_public",
          visitorId: "visitor-1",
          conversationId: "conversation-1",
          message: "Hello",
        },
        {},
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("returns 403 Widget Disabled for inactive public widgets", async () => {
    const deps = createDependencies();
    deps.widgets.findPublicCandidate.mockResolvedValue(widgetFixture({ status: "INACTIVE" }));
    const service = createService(deps);

    await expect(
      service.initialize({ widgetId: "widget-1", publicKey: "wpk_public" }, { ip: "127.0.0.1" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.initialize({ widgetId: "widget-1", publicKey: "wpk_public" }, { ip: "127.0.0.1" }),
    ).rejects.toThrow("Widget Disabled");
  });

  it("rejects public widget calls unless widgetId and publicKey match", async () => {
    const deps = createDependencies();
    deps.widgets.findPublicCandidate.mockResolvedValue(null);
    const service = createService(deps);

    await expect(
      service.sendMessage(
        {
          widgetId: "widget-1",
          publicKey: "wrong-key",
          visitorId: "visitor-1",
          conversationId: "conversation-1",
          message: "Hello",
        },
        {},
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("returns a validation failure instead of 500 when the assigned agent is deleted", async () => {
    const deps = createDependencies();
    deps.widgets.findPublicCandidate.mockResolvedValue(
      widgetFixture({ agent: { deletedAt: new Date("2026-06-08T12:00:00.000Z") } }),
    );
    const service = createService(deps);

    await expect(
      service.initialize({ widgetId: "widget-1", publicKey: "wpk_public" }),
    ).rejects.toThrow("Widget Agent Unavailable");
  });
});

function createService(deps: ReturnType<typeof createDependencies>) {
  return new WidgetService(
    deps.widgets as never,
    deps.responses as never,
    deps.rateLimits as never,
  );
}

function createDependencies() {
  return {
    widgets: {
      agentExists: jest.fn(),
      create: jest.fn(),
      findPublicCandidate: jest.fn(),
      upsertVisitor: jest.fn().mockResolvedValue({}),
      conversationForVisitor: jest.fn(),
      createConversation: jest.fn(),
      createAuditEvent: jest.fn().mockResolvedValue({}),
    },
    responses: {
      send: jest.fn(),
    },
    rateLimits: {
      assertAllowed: jest.fn().mockResolvedValue(undefined),
    },
  };
}

function widgetFixture(
  overrides: Partial<{
    status: string;
    agent: Partial<{
      id: string;
      name: string;
      status: string;
      organizationId: string;
      deletedAt: Date | null;
    }>;
  }> = {},
) {
  const now = new Date("2026-06-08T12:00:00.000Z");
  return {
    id: "widget-1",
    organizationId: "org-1",
    agentId: "agent-1",
    name: "Website Chat",
    status: overrides.status ?? "ACTIVE",
    publicKey: "wpk_public",
    primaryColor: "#0f766e",
    position: "BOTTOM_RIGHT",
    welcomeMessage: "Hi",
    createdAt: now,
    updatedAt: now,
    agent: {
      id: "agent-1",
      name: "Support",
      status: "ACTIVE",
      organizationId: "org-1",
      deletedAt: null,
      ...overrides.agent,
    },
  };
}

function conversationFixture() {
  const now = new Date("2026-06-08T12:00:00.000Z");
  return {
    id: "conversation-1",
    organizationId: "org-1",
    agentId: "agent-1",
    visitorId: "visitor-1",
    sessionId: "widget:widget-1:visitor-1",
    channel: "WEB_CHAT",
    status: "ACTIVE",
    source: "WIDGET",
    startedAt: now,
    lastMessageAt: null,
    endedAt: null,
    createdAt: now,
    updatedAt: now,
    agent: { id: "agent-1", name: "Support", status: "ACTIVE" },
    _count: { messages: 0 },
  };
}
