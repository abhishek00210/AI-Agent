import { OrganizationLocaleService } from "./organization-locale.service";

describe("OrganizationLocaleService", () => {
  const prisma = {
    organization: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(() => jest.clearAllMocks());

  it("resolves Canada defaults from organization settings", async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: "org-1",
      country: "CA",
      countryCode: "CA",
      currency: "CAD",
      timezone: "America/Toronto",
      language: "en",
      telephonyProvider: "TWILIO",
      paymentProvider: "STRIPE",
      dateFormat: "yyyy-MM-dd",
      timeFormat: "HH:mm",
      numberFormat: "+1",
      businessHoursTimezone: "America/Toronto",
      taxRegion: "GST/HST",
    });
    const service = new OrganizationLocaleService(prisma as never);

    await expect(service.getOrganizationLocale("org-1")).resolves.toMatchObject({
      country: "CA",
      currency: "CAD",
      timezone: "America/Toronto",
      telephonyProvider: "TWILIO",
      paymentProvider: "STRIPE",
      taxRules: { label: "GST/HST" },
      phoneRegion: "CA",
    });
  });

  it("resolves India defaults and caches repeated lookups", async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: "org-2",
      country: "IN",
      countryCode: "IN",
      currency: "INR",
      timezone: "Asia/Kolkata",
      language: "en",
      telephonyProvider: "EXOTEL",
      paymentProvider: "RAZORPAY",
      dateFormat: "dd/MM/yyyy",
      timeFormat: "HH:mm",
      numberFormat: "+91",
      businessHoursTimezone: "Asia/Kolkata",
      taxRegion: "GST",
    });
    const service = new OrganizationLocaleService(prisma as never);

    const first = await service.getOrganizationLocale("org-2");
    const second = await service.getOrganizationLocale("org-2");

    expect(first).toMatchObject({
      country: "IN",
      currency: "INR",
      timezone: "Asia/Kolkata",
      telephonyProvider: "EXOTEL",
      paymentProvider: "RAZORPAY",
      taxRules: { label: "GST" },
      phoneRegion: "IN",
    });
    expect(second).toBe(first);
    expect(prisma.organization.findFirst).toHaveBeenCalledTimes(1);
  });
});
