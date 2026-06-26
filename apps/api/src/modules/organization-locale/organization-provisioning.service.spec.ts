import { OrganizationProvisioningService } from "./organization-provisioning.service";

describe("OrganizationProvisioningService", () => {
  const service = new OrganizationProvisioningService();
  const trialStartsAt = new Date("2026-06-25T00:00:00.000Z");
  const trialEndsAt = new Date("2026-07-09T00:00:00.000Z");

  it("builds Canadian signup defaults without trusting provider input", () => {
    expect(
      service.buildCreateData({
        name: "Canada Co",
        slug: "canada-co",
        country: "CA",
        industry: "Roofing",
        trialStartsAt,
        trialEndsAt,
      }),
    ).toMatchObject({
      country: "CA",
      countryCode: "CA",
      currency: "CAD",
      timezone: "America/Toronto",
      telephonyProvider: "TWILIO",
      paymentProvider: "STRIPE",
      taxRegion: "GST/HST",
      plan: "STARTER",
      provisionStatus: "PROVISIONED",
    });
  });

  it("builds Indian signup defaults with Exotel, Razorpay, INR, and India formats", () => {
    expect(
      service.buildCreateData({
        name: "India Co",
        slug: "india-co",
        country: "IN",
        industry: "Clinic",
        companySize: "2-10",
        trialStartsAt,
        trialEndsAt,
      }),
    ).toMatchObject({
      country: "IN",
      countryCode: "IN",
      currency: "INR",
      timezone: "Asia/Kolkata",
      telephonyProvider: "EXOTEL",
      paymentProvider: "RAZORPAY",
      taxRegion: "GST",
      dateFormat: "dd-MM-yyyy",
      timeFormat: "hh:mm a",
      numberFormat: "+91",
      companySize: "2-10",
    });
  });
});
