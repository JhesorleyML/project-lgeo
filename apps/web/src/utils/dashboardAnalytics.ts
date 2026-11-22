import {
  HEADLINE_CHOROPLETH_METRICS,
  LANDMARK_SECTORS,
  type BarangayAggregatedReportRow,
  type HeadlineChoroplethMetricId,
  type VulnerabilityCriterionId,
} from "@cbms/shared";

export type DashboardTabId =
  | "poverty_mpi"
  | "education_livelihood"
  | "social_protection_wash"
  | "gis_infrastructure";

export type DashboardUnitMode = "rate" | "count";

export interface DashboardChoroplethRow {
  barangayGeoCode: string;
  barangayName: string;
  totalHouseholds: number;
  totalPopulation: number;
  poorHouseholds: number;
  poor_rate: number;
  near_poor_5_rate: number;
  near_poor_10_rate: number;
  near_poor_15_rate: number;
  near_poor_20_rate: number;
  near_poor_25_rate: number;
  electricity_rate: number;
  internet_rate: number;
  beneficiary_4ps_rate: number;
}

export interface MpiRadarDatum {
  axis: string;
  shortAxis: string;
  scopeRate: number;
  municipalRate: number;
  scopeCount: number;
  municipalCount: number;
}

export interface PovertyBufferStepDatum {
  threshold: string;
  shortLabel: string;
  rate: number;
  households: number;
  municipalRate: number;
}

export interface EducationChartDatum {
  barangayGeoCode: string;
  barangayName: string;
  osyValue: number;
  nonLiterateValue: number;
  tvetValue: number;
  attendingValue: number;
  osyCount: number;
  nonLiterateCount: number;
  tvetCount: number;
  attendingCount: number;
}

export interface LivelihoodChartDatum {
  barangayGeoCode: string;
  barangayName: string;
  fisherfolkValue: number;
  farmerValue: number;
  unemployedValue: number;
  underemployedValue: number;
  ofwValue: number;
  fisherfolkCount: number;
  farmerCount: number;
  unemployedCount: number;
  underemployedCount: number;
  ofwCount: number;
}

export interface FourPsGapChartDatum {
  barangayGeoCode: string;
  barangayName: string;
  coveredPoorValue: number;
  unreachedPoorGapValue: number;
  coveredPoorCount: number;
  unreachedPoorGapCount: number;
  totalPoorCount: number;
}

export interface VulnerableSectorBarDatum {
  id: string;
  label: string;
  sectionRef: string;
  value: number;
  count: number;
  rate: number;
  color: string;
  mapCriterion?: VulnerabilityCriterionId;
}

export interface YoYMetricComparisonDatum {
  code: string;
  name: string;
  hh2022: number;
  hh2024: number;
  val2022: number;
  val2024: number;
  delta: number;
  isPositiveOutcome: boolean;
  poor2022: number;
  poor2024: number;
  poorDelta: number;
  net2022: number;
  net2024: number;
  netDelta: number;
}

export function toPct(count: number, total: number): number {
  if (total <= 0) return 0;
  return Number(((count / total) * 100).toFixed(1));
}

export function parseChoroplethFeatures(
  rawFeatures: Array<{ properties?: Record<string, unknown> }>,
): DashboardChoroplethRow[] {
  return rawFeatures.map((f) => {
    const p = f.properties ?? {};
    return {
      barangayGeoCode: String(p.barangayGeoCode ?? ""),
      barangayName: String(p.barangayName ?? ""),
      totalHouseholds: Number(p.totalHouseholds ?? 0),
      totalPopulation: Number(p.totalPopulation ?? 0),
      poorHouseholds: Number(p.poorHouseholds ?? 0),
      poor_rate: Number(p.poor_rate ?? 0),
      near_poor_5_rate: Number(p.near_poor_5_rate ?? 0),
      near_poor_10_rate: Number(p.near_poor_10_rate ?? 0),
      near_poor_15_rate: Number(p.near_poor_15_rate ?? 0),
      near_poor_20_rate: Number(p.near_poor_20_rate ?? 0),
      near_poor_25_rate: Number(p.near_poor_25_rate ?? 0),
      electricity_rate: Number(p.electricity_rate ?? 0),
      internet_rate: Number(p.internet_rate ?? 0),
      beneficiary_4ps_rate: Number(p.beneficiary_4ps_rate ?? 0),
    };
  });
}

export function getMetricValueFromChoroplethRow(
  row: DashboardChoroplethRow,
  metric: HeadlineChoroplethMetricId,
  unitMode: DashboardUnitMode,
): number {
  const rate = Number(row[metric] ?? 0);
  if (unitMode === "rate") {
    return Number(rate.toFixed(1));
  }
  return Math.round((rate / 100) * row.totalHouseholds);
}

/**
 * Builds the 10-Axis Multidimensional Deprivation Radar dataset (OPHI MPI pattern)
 * explicitly including Education (Out-of-School Youth) and Employment (Unemployment)
 * alongside Income Poverty, Hunger, Water, Sanitation, Housing, Electricity, Internet, and Disaster Shocks.
 */
export function build10AxisMpiRadarData(
  reportRows: readonly BarangayAggregatedReportRow[],
  selectedBarangayCode: string,
): MpiRadarDatum[] {
  const totalMunHh = reportRows.reduce((s, r) => s + r.totalHouseholds, 0);

  const scopeRows =
    selectedBarangayCode !== "ALL"
      ? reportRows.filter((r) => r.barangayGeoCode === selectedBarangayCode)
      : reportRows;
  const totalScopeHh = scopeRows.reduce((s, r) => s + r.totalHouseholds, 0);

  const axes: Array<{
    axis: string;
    shortAxis: string;
    getter: (r: BarangayAggregatedReportRow) => number;
  }> = [
    {
      axis: "1. Income Poverty (Poor HH)",
      shortAxis: "Poverty",
      getter: (r) => r.poorHouseholds,
    },
    {
      axis: "2. Education: Out-of-School Youth (Sec D)",
      shortAxis: "OSY (Edu)",
      getter: (r) => r.householdsWithOsy ?? r.outOfSchoolYouthCount,
    },
    {
      axis: "3. Employment: Unemployed (Sec E)",
      shortAxis: "Unemployed",
      getter: (r) => r.unemployedCount,
    },
    {
      axis: "4. Food Insecurity / Hunger (Sec G)",
      shortAxis: "Hunger",
      getter: (r) => r.foodInsecureHouseholds,
    },
    {
      axis: "5. Unimproved Drinking Water (Sec N)",
      shortAxis: "Water Gap",
      getter: (r) => r.unimprovedWaterHouseholds,
    },
    {
      axis: "6. Unsanitary Toilet Facility (Sec N)",
      shortAxis: "Sanitation",
      getter: (r) => r.unimprovedSanitationHouseholds,
    },
    {
      axis: "7. Light / Makeshift Housing (Sec O)",
      shortAxis: "Housing",
      getter: (r) => r.makeshiftHousingHouseholds,
    },
    {
      axis: "8. Without Electricity (Sec O)",
      shortAxis: "No Power",
      getter: (r) => r.noElectricityHouseholds,
    },
    {
      axis: "9. Without Home Internet (Sec K)",
      shortAxis: "No Internet",
      getter: (r) => r.noInternetHouseholds,
    },
    {
      axis: "10. Climate / Disaster Shock (Sec J)",
      shortAxis: "Disaster",
      getter: (r) => r.disasterShockHouseholds,
    },
  ];

  return axes.map((a) => {
    const munCount = reportRows.reduce((s, r) => s + a.getter(r), 0);
    const scopeCount = scopeRows.reduce((s, r) => s + a.getter(r), 0);
    return {
      axis: a.axis,
      shortAxis: a.shortAxis,
      scopeRate: toPct(scopeCount, totalScopeHh),
      municipalRate: toPct(munCount, totalMunHh),
      scopeCount,
      municipalCount: munCount,
    };
  });
}

/**
 * Builds the 6-tier Graduated Poverty & Shock-Vulnerability Buffer Curve
 * (Official Poor -> Near-Poor +5%, +10%, +15%, +20%, +25%)
 */
export function buildGraduatedPovertyCurveData(
  choroplethRows: readonly DashboardChoroplethRow[],
  selectedBarangayCode: string,
): PovertyBufferStepDatum[] {
  const totalMunHh = choroplethRows.reduce((s, r) => s + r.totalHouseholds, 0);
  const scopeRows =
    selectedBarangayCode !== "ALL"
      ? choroplethRows.filter((r) => r.barangayGeoCode === selectedBarangayCode)
      : choroplethRows;
  const totalScopeHh = scopeRows.reduce((s, r) => s + r.totalHouseholds, 0);

  const tiers: Array<{
    threshold: string;
    shortLabel: string;
    key: keyof Pick<
      DashboardChoroplethRow,
      | "poor_rate"
      | "near_poor_5_rate"
      | "near_poor_10_rate"
      | "near_poor_15_rate"
      | "near_poor_20_rate"
      | "near_poor_25_rate"
    >;
  }> = [
    { threshold: "Official Poor (0%)", shortLabel: "Poor", key: "poor_rate" },
    {
      threshold: "Near-Poor (+5% Buffer)",
      shortLabel: "+5%",
      key: "near_poor_5_rate",
    },
    {
      threshold: "Near-Poor (+10% Buffer)",
      shortLabel: "+10%",
      key: "near_poor_10_rate",
    },
    {
      threshold: "Near-Poor (+15% Buffer)",
      shortLabel: "+15%",
      key: "near_poor_15_rate",
    },
    {
      threshold: "Near-Poor (+20% Buffer)",
      shortLabel: "+20%",
      key: "near_poor_20_rate",
    },
    {
      threshold: "Near-Poor (+25% Buffer)",
      shortLabel: "+25%",
      key: "near_poor_25_rate",
    },
  ];

  return tiers.map((t) => {
    const scopeHh = scopeRows.reduce(
      (s, r) => s + Math.round(((r[t.key] ?? 0) / 100) * r.totalHouseholds),
      0,
    );
    const munHh = choroplethRows.reduce(
      (s, r) => s + Math.round(((r[t.key] ?? 0) / 100) * r.totalHouseholds),
      0,
    );
    return {
      threshold: t.threshold,
      shortLabel: t.shortLabel,
      rate: toPct(scopeHh, totalScopeHh),
      households: scopeHh,
      municipalRate: toPct(munHh, totalMunHh),
    };
  });
}

/**
 * Builds Tab 2 Left Chart: Education, Out-of-School Youth (OSY), Basic Literacy Gap & TVET (Sections A & D)
 */
export function buildEducationChartData(
  reportRows: readonly BarangayAggregatedReportRow[],
  unitMode: DashboardUnitMode,
): EducationChartDatum[] {
  return reportRows
    .map((r) => {
      const osyCount = r.householdsWithOsy ?? r.outOfSchoolYouthCount ?? 0;
      const nonLitCount =
        r.nonLiterateCount ?? r.indicatorCounts?.non_literate ?? 0;
      const tvetCount =
        r.tvetCount ?? r.indicatorCounts?.tvet_graduate_or_attending ?? 0;
      const attendingCount =
        r.attendingSchoolCount ?? r.indicatorCounts?.attending_school ?? 0;
      const hh = r.totalHouseholds;

      return {
        barangayGeoCode: r.barangayGeoCode,
        barangayName: r.barangayName,
        osyValue: unitMode === "rate" ? toPct(osyCount, hh) : osyCount,
        nonLiterateValue:
          unitMode === "rate" ? toPct(nonLitCount, hh) : nonLitCount,
        tvetValue: unitMode === "rate" ? toPct(tvetCount, hh) : tvetCount,
        attendingValue:
          unitMode === "rate" ? toPct(attendingCount, hh) : attendingCount,
        osyCount,
        nonLiterateCount: nonLitCount,
        tvetCount,
        attendingCount,
      };
    })
    .sort((a, b) => b.osyValue - a.osyValue);
}

/**
 * Builds Tab 2 Right Chart: Employment, Livelihood (Fisherfolk vs. Farmers) & Labor Force (Sections C & E)
 */
export function buildLivelihoodChartData(
  reportRows: readonly BarangayAggregatedReportRow[],
  unitMode: DashboardUnitMode,
): LivelihoodChartDatum[] {
  return reportRows
    .map((r) => {
      const fisherfolkCount = r.fisherfolkCount ?? 0;
      const farmerCount = r.farmerCount ?? 0;
      const unemployedCount = r.unemployedCount ?? 0;
      const underemployedCount =
        r.underemployedCount ?? r.indicatorCounts?.underemployed ?? 0;
      const ofwCount = r.ofwCount ?? r.indicatorCounts?.ofw_member ?? 0;
      const hh = r.totalHouseholds;

      return {
        barangayGeoCode: r.barangayGeoCode,
        barangayName: r.barangayName,
        fisherfolkValue:
          unitMode === "rate" ? toPct(fisherfolkCount, hh) : fisherfolkCount,
        farmerValue: unitMode === "rate" ? toPct(farmerCount, hh) : farmerCount,
        unemployedValue:
          unitMode === "rate" ? toPct(unemployedCount, hh) : unemployedCount,
        underemployedValue:
          unitMode === "rate"
            ? toPct(underemployedCount, hh)
            : underemployedCount,
        ofwValue: unitMode === "rate" ? toPct(ofwCount, hh) : ofwCount,
        fisherfolkCount,
        farmerCount,
        unemployedCount,
        underemployedCount,
        ofwCount,
      };
    })
    .sort(
      (a, b) =>
        b.fisherfolkValue + b.farmerValue - (a.fisherfolkValue + a.farmerValue),
    );
}

/**
 * Builds Tab 3 Left Chart: 4Ps Coverage vs. Unreached Poor (no_4ps_poor Gap) per Barangay
 */
export function buildFourPsGapChartData(
  reportRows: readonly BarangayAggregatedReportRow[],
  unitMode: DashboardUnitMode,
): FourPsGapChartDatum[] {
  return reportRows
    .map((r) => {
      const unreached = r.no4psPoorHouseholds ?? 0;
      const coveredPoor = Math.max(0, r.poorHouseholds - unreached);
      const hh = r.totalHouseholds;

      return {
        barangayGeoCode: r.barangayGeoCode,
        barangayName: r.barangayName,
        coveredPoorValue:
          unitMode === "rate" ? toPct(coveredPoor, hh) : coveredPoor,
        unreachedPoorGapValue:
          unitMode === "rate" ? toPct(unreached, hh) : unreached,
        coveredPoorCount: coveredPoor,
        unreachedPoorGapCount: unreached,
        totalPoorCount: r.poorHouseholds,
      };
    })
    .sort(
      (a, b) =>
        b.unreachedPoorGapValue +
        b.coveredPoorValue -
        (a.unreachedPoorGapValue + a.coveredPoorValue),
    );
}

/**
 * Builds Tab 3 Right Chart: Vulnerable Demographic Groups & Basic Service Deprivations
 * with direct MapLibre GPU filter criterion deep links.
 */
export function buildVulnerableSectorBars(
  reportRows: readonly BarangayAggregatedReportRow[],
  selectedBarangayCode: string,
  unitMode: DashboardUnitMode,
): VulnerableSectorBarDatum[] {
  const scopeRows =
    selectedBarangayCode !== "ALL"
      ? reportRows.filter((r) => r.barangayGeoCode === selectedBarangayCode)
      : reportRows;
  const totalHh = scopeRows.reduce((s, r) => s + r.totalHouseholds, 0);

  const items: Array<{
    id: string;
    label: string;
    sectionRef: string;
    getter: (r: BarangayAggregatedReportRow) => number;
    color: string;
    mapCriterion?: VulnerabilityCriterionId;
  }> = [
    {
      id: "senior_citizen",
      label: "Senior Citizens (Age ≥ 60)",
      sectionRef: "Sec A (a05_age >= 60)",
      getter: (r) => r.householdsWithSenior ?? r.seniorCitizensCount,
      color: "#f59e0b",
      mapCriterion: "senior_citizen",
    },
    {
      id: "pwd",
      label: "Persons with Disability (PWD)",
      sectionRef: "Sec B (b10_pwd = 1)",
      getter: (r) => r.householdsWithPwd ?? r.pwdCount,
      color: "#a855f7",
      mapCriterion: "pwd",
    },
    {
      id: "solo_parent",
      label: "Solo Parent Households",
      sectionRef: "Sec B (b05_solo_parent = 1)",
      getter: (r) => r.soloParentCount,
      color: "#ec4899",
      mapCriterion: "solo_parent",
    },
    {
      id: "food_insecure",
      label: "Food Insecure / Hunger (FIES)",
      sectionRef: "Sec G (g04/g06/g07 = 1)",
      getter: (r) => r.foodInsecureHouseholds,
      color: "#f43f5e",
      mapCriterion: "food_insecure",
    },
    {
      id: "unimproved_water",
      label: "Unimproved Drinking Water",
      sectionRef: "Sec N (n03_service_level > 1)",
      getter: (r) => r.unimprovedWaterHouseholds,
      color: "#06b6d4",
      mapCriterion: "unimproved_water",
    },
    {
      id: "unimproved_sanitation",
      label: "Unsanitary Toilet Facility",
      sectionRef: "Sec N (n10_sanitation > 2)",
      getter: (r) => r.unimprovedSanitationHouseholds,
      color: "#14b8a6",
    },
    {
      id: "makeshift_housing",
      label: "Light / Salvaged Housing",
      sectionRef: "Sec O (o03_roof/o04_walls >= 3)",
      getter: (r) => r.makeshiftHousingHouseholds,
      color: "#f97316",
      mapCriterion: "makeshift_housing",
    },
    {
      id: "disaster_shock",
      label: "Typhoon / Flood Shock",
      sectionRef: "Sec J (j01_a/j01_d/j01_e = 1)",
      getter: (r) => r.disasterShockHouseholds,
      color: "#eab308",
      mapCriterion: "disaster_shock",
    },
  ];

  return items.map((item) => {
    const count = scopeRows.reduce((s, r) => s + item.getter(r), 0);
    const rate = toPct(count, totalHh);
    return {
      id: item.id,
      label: item.label,
      sectionRef: item.sectionRef,
      value: unitMode === "rate" ? rate : count,
      count,
      rate,
      color: item.color,
      mapCriterion: item.mapCriterion,
    };
  });
}

/**
 * Aggregates GIS Reference Layers (CLUP Land Use Hectares, Road Condition km, and Facility Sectors)
 */
export function aggregateGisInfrastructureData(
  landUseFeatures: Array<{ properties?: Record<string, unknown> }>,
  roadFeatures: Array<{ properties?: Record<string, unknown> }>,
  landmarkFeatures: Array<{ properties?: Record<string, unknown> }>,
) {
  const luMap = new Map<string, number>();
  for (const f of landUseFeatures) {
    const cat = String(
      f.properties?.luCategory ?? f.properties?.luName ?? "Unclassified",
    );
    const ha = Number(f.properties?.areaHectares ?? 0);
    luMap.set(cat, (luMap.get(cat) ?? 0) + ha);
  }
  const landUseByCategory = Array.from(luMap.entries())
    .map(([category, hectares]) => ({
      category,
      hectares: Number(hectares.toFixed(2)),
    }))
    .sort((a, b) => b.hectares - a.hectares)
    .slice(0, 8);

  const roadCondMap = new Map<string, number>();
  for (const f of roadFeatures) {
    const cond = String(f.properties?.roadCondition ?? "Unspecified");
    const km = Number(f.properties?.lengthMeters ?? 0) / 1000;
    roadCondMap.set(cond, (roadCondMap.get(cond) ?? 0) + km);
  }
  const roadsByCondition = Array.from(roadCondMap.entries())
    .map(([condition, lengthKm]) => ({
      condition,
      lengthKm: Number(lengthKm.toFixed(2)),
    }))
    .sort((a, b) => b.lengthKm - a.lengthKm);

  const sectorCountMap = new Map<string, number>();
  for (const f of landmarkFeatures) {
    const sec = String(f.properties?.sectorCategory ?? "GOVERNANCE");
    sectorCountMap.set(sec, (sectorCountMap.get(sec) ?? 0) + 1);
  }
  const facilitiesBySector = LANDMARK_SECTORS.map((s) => ({
    id: s.id,
    label: s.label,
    color: s.color,
    count: sectorCountMap.get(s.id) ?? 0,
  })).sort((a, b) => b.count - a.count);

  return {
    landUseByCategory,
    roadsByCondition,
    facilitiesBySector,
  };
}

export function isCoverageMetric(metric: HeadlineChoroplethMetricId): boolean {
  return (
    metric === "electricity_rate" ||
    metric === "internet_rate" ||
    metric === "beneficiary_4ps_rate"
  );
}

/**
 * Builds Longitudinal 2022 vs. 2024 Comparison & Diverging Percentage-Point Delta rows
 */
export function buildYoYComparisonRows(
  features2022: Array<{ properties?: Record<string, unknown> }>,
  features2024: Array<{ properties?: Record<string, unknown> }>,
  activeMetric: HeadlineChoroplethMetricId,
): {
  rows: YoYMetricComparisonDatum[];
  totalHh2022: number;
  totalHh2024: number;
  avgVal2022: number;
  avgVal2024: number;
  avgDelta: number;
} {
  const map2022 = new Map<string, Record<string, unknown>>();
  for (const f of features2022) {
    const code = String(f.properties?.barangayGeoCode ?? "");
    if (code) map2022.set(code, f.properties ?? {});
  }

  const map2024 = new Map<string, Record<string, unknown>>();
  for (const f of features2024) {
    const code = String(f.properties?.barangayGeoCode ?? "");
    if (code) map2024.set(code, f.properties ?? {});
  }

  const allCodes = Array.from(
    new Set([...map2024.keys(), ...map2022.keys()]),
  ).sort();

  // For deprivation metrics (poor_rate, near_poor_*), a negative delta (reduction) is a positive outcome.
  // For coverage metrics (electricity_rate, internet_rate, beneficiary_4ps_rate), a positive delta is a positive outcome.
  const lowerIsBetter = !isCoverageMetric(activeMetric);

  let hh2022Sum = 0;
  let hh2024Sum = 0;

  const rows: YoYMetricComparisonDatum[] = allCodes.map((code) => {
    const y2022 = map2022.get(code) ?? {};
    const y2024 = map2024.get(code) ?? {};
    const name = String(y2024.barangayName ?? y2022.barangayName ?? code);
    const hh2022 = Number(y2022.totalHouseholds ?? 0);
    const hh2024 = Number(y2024.totalHouseholds ?? 0);
    hh2022Sum += hh2022;
    hh2024Sum += hh2024;

    const val2022 = Number(Number(y2022[activeMetric] ?? 0).toFixed(1));
    const val2024 = Number(Number(y2024[activeMetric] ?? 0).toFixed(1));
    const delta = Number((val2024 - val2022).toFixed(1));
    const isPositiveOutcome = lowerIsBetter ? delta <= 0 : delta >= 0;

    const poor2022 = Number(Number(y2022.poor_rate ?? 0).toFixed(1));
    const poor2024 = Number(Number(y2024.poor_rate ?? 0).toFixed(1));
    const poorDelta = Number((poor2024 - poor2022).toFixed(1));
    const net2022 = Number(Number(y2022.internet_rate ?? 0).toFixed(1));
    const net2024 = Number(Number(y2024.internet_rate ?? 0).toFixed(1));
    const netDelta = Number((net2024 - net2022).toFixed(1));

    return {
      code,
      name,
      hh2022,
      hh2024,
      val2022,
      val2024,
      delta,
      isPositiveOutcome,
      poor2022,
      poor2024,
      poorDelta,
      net2022,
      net2024,
      netDelta,
    };
  });

  const avgVal2022 =
    rows.length > 0
      ? Number(
          (rows.reduce((s, r) => s + r.val2022, 0) / rows.length).toFixed(1),
        )
      : 0;
  const avgVal2024 =
    rows.length > 0
      ? Number(
          (rows.reduce((s, r) => s + r.val2024, 0) / rows.length).toFixed(1),
        )
      : 0;
  const avgDelta = Number((avgVal2024 - avgVal2022).toFixed(1));

  return {
    rows,
    totalHh2022: hh2022Sum,
    totalHh2024: hh2024Sum,
    avgVal2022,
    avgVal2024,
    avgDelta,
  };
}
