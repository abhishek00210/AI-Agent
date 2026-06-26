import {
  canonicalTimezone,
  addMinutes,
  getWeekday,
  localDateTimeToUtc,
  minutesSinceMidnight,
  timeToMinutes,
} from "./appointment-time";

describe("appointment time helpers", () => {
  it("treats IANA timezone aliases as the same scheduling timezone", () => {
    expect(canonicalTimezone("Asia/Kolkata")).toBe(canonicalTimezone("Asia/Calcutta"));
  });
  it("converts customer local appointment time to UTC", () => {
    const utc = localDateTimeToUtc("2026-07-01", "14:00", "America/Toronto");

    expect(utc.toISOString()).toBe("2026-07-01T18:00:00.000Z");
  });

  it("handles America/Toronto spring-forward DST bookings", () => {
    expect(localDateTimeToUtc("2026-03-08", "01:30", "America/Toronto").toISOString()).toBe(
      "2026-03-08T06:30:00.000Z",
    );
    expect(localDateTimeToUtc("2026-03-08", "03:30", "America/Toronto").toISOString()).toBe(
      "2026-03-08T07:30:00.000Z",
    );
  });

  it("handles America/Toronto fall-back DST bookings", () => {
    expect(localDateTimeToUtc("2026-11-01", "01:30", "America/Toronto").toISOString()).toBe(
      "2026-11-01T05:30:00.000Z",
    );
    expect(localDateTimeToUtc("2026-11-01", "02:30", "America/Toronto").toISOString()).toBe(
      "2026-11-01T07:30:00.000Z",
    );
  });

  it("keeps weekday and local minutes timezone-aware", () => {
    const utc = new Date("2026-07-01T18:00:00.000Z");

    expect(getWeekday(utc, "America/Toronto")).toBe(3);
    expect(minutesSinceMidnight(utc, "America/Toronto")).toBe(14 * 60);
  });

  it("adds durations and parses HH:mm windows", () => {
    const start = new Date("2026-07-01T18:00:00.000Z");

    expect(addMinutes(start, 30).toISOString()).toBe("2026-07-01T18:30:00.000Z");
    expect(timeToMinutes("09:30")).toBe(570);
  });
});
