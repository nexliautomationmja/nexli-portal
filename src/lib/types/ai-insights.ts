export interface InsightItem {
  title: string;
  detail: string;
}

export interface AIInsightsData {
  strengths: InsightItem[];
  issues: InsightItem[];
  actionPlan: InsightItem[];
  generatedAt: string;
  range: string;
}
