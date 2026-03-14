export interface ConversionFunnelData {
  totalLeads: number;
  respondedLeads: number;
  bookedConsultations: number;
  conversionRate: number;
  previousConversionRate: number | null;
  benchmarkLow: number;
  benchmarkHigh: number;
}

export interface SpeedToLeadData {
  averageResponseMinutes: number;
  medianResponseMinutes: number;
  distribution: {
    under5min: number;
    from5to30min: number;
    over30min: number;
  };
  performanceRating: "green" | "yellow" | "red";
  aiResponses: number;
  humanResponses: number;
  totalMeasured: number;
}

export interface GHLMetricsData {
  conversion: ConversionFunnelData;
  speedToLead: SpeedToLeadData;
}
