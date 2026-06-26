import { MemoryFactService } from "./memory-fact.service";

describe("MemoryFactService", () => {
  it("extracts normalized high-confidence facts from provider JSON", async () => {
    const provider = {
      generateResponse: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          facts: [
            {
              factType: "CONTACT",
              factKey: "Phone Number",
              factValue: "+1 555 0100",
              confidence: 0.91,
            },
            {
              factType: "CUSTOM",
              factKey: "maybe",
              factValue: "uncertain",
              confidence: 0.2,
            },
          ],
        }),
      }),
    };
    const service = new MemoryFactService(provider as never);

    const facts = await service.extract({
      messages: [
        {
          senderType: "USER",
          content: "My phone is +1 555 0100",
          tokenCount: 8,
          createdAt: new Date("2026-06-08T12:00:00.000Z"),
        },
      ],
      userId: "user-1",
    });

    expect(facts).toEqual([
      {
        factType: "CONTACT",
        factKey: "phone_number",
        factValue: "+1 555 0100",
        confidence: 0.91,
      },
    ]);
  });
});
