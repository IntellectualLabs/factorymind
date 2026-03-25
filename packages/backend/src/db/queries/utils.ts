import type { RiskLevel } from "@factorymind/types";

export function riskLevel(score: number): RiskLevel {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

export function recommendedLoad(risk: RiskLevel): "heavy" | "normal" | "light" | "avoid" {
  switch (risk) {
    case "high": return "avoid";
    case "medium": return "light";
    case "low": return "heavy";
  }
}

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
