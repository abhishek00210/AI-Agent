export type VerificationStatus = "PASS" | "WARN" | "FAIL";

export interface VerificationCheck {
  id: string;
  area: string;
  status: VerificationStatus;
  message: string;
  evidence?: Record<string, string | number | boolean | null>;
}

export interface PerformanceMeasurement {
  name: string;
  samples: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  targetP95Ms: number;
  status: VerificationStatus;
}

export interface LaunchReadinessResult {
  generatedAt: string;
  environment: string;
  checks: VerificationCheck[];
  performance: PerformanceMeasurement[];
  summary: { pass: number; warn: number; fail: number; recommendation: "GO" | "CONDITIONAL_GO" | "NO_GO" };
}
