import { TelephonyProviderFactory } from "./telephony-provider.factory";
import { TelephonyModule } from "./telephony.module";
import { TwilioModule } from "../twilio/twilio.module";

describe("TelephonyProviderFactory", () => {
  const twilio = { name: "TWILIO" };
  const exotel = { name: "EXOTEL" };

  it("re-exports Twilio protocol services needed by signed webhook handlers", () => {
    const exports = Reflect.getMetadata("exports", TelephonyModule) as unknown[];
    expect(exports).toContain(TwilioModule);
  });

  it("routes Canada to Twilio and India to the registered Exotel provider", () => {
    const factory = createFactory({ "telephony.defaultProvider": "TWILIO" });
    expect(factory.resolve({ organizationCountry: "CA" })).toBe(twilio);
    expect(factory.resolve({ organizationCountry: "IN" })).toBe(exotel);
  });

  it("honors country and explicit provider overrides", () => {
    const factory = createFactory({
      "telephony.defaultProvider": "TWILIO",
      "telephony.providers.IN": "TWILIO",
    });
    expect(factory.resolve({ organizationCountry: "IN" })).toBe(twilio);
    expect(factory.resolve({ organizationCountry: "CA", provider: "EXOTEL" })).toBe(exotel);
  });

  function createFactory(values: Record<string, string>) {
    return new TelephonyProviderFactory(
      { get: jest.fn((key: string) => values[key]) } as never,
      twilio as never,
      exotel as never,
    );
  }
});
