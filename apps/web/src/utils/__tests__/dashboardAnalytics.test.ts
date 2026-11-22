import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { BarangayAggregatedReportRow } from "@cbms/shared";
import {
  aggregateGisInfrastructureData,
  build10AxisMpiRadarData,
  buildEducationChartData,
  buildFourPsGapChartData,
  buildGraduatedPovertyCurveData,
  buildLivelihoodChartData,
  buildVulnerableSectorBars,
  buildYoYComparisonRows,
  getMetricValueFromChoroplethRow,
  parseChoroplethFeatures,
} from "../dashboardAnalytics.js";

const MOCK_BARANGAY_REPORT_ROWS: readonly BarangayAggregatedReportRow[] = [
  {
    barangayGeoCode: "1608506001",
    barangayName: "Aurelio",
    totalHouseholds: 612,
    totalPopulation: 2685,
    totalMales: 1375,
    totalFemales: 1310,
    matchingHouseholds: 612,
    matchingRate: 100,
    poorHouseholds: 174,
    poorRate: 28.4,
    nearPoor5Households: 222,
    fourPsHouseholds: 150,
    fourPsRate: 24.5,
    no4psPoorHouseholds: 24,
    outOfSchoolYouthCount: 72,
    householdsWithOsy: 61,
    attendingSchoolCount: 410,
    nonLiterateCount: 28,
    tvetCount: 84,
    seniorCitizensCount: 185,
    householdsWithSenior: 148,
    pwdCount: 54,
    householdsWithPwd: 49,
    soloParentCount: 39,
    fisherfolkCount: 118,
    farmerCount: 88,
    unemployedCount: 64,
    underemployedCount: 112,
    ofwCount: 34,
    foodInsecureHouseholds: 94,
    unimprovedWaterHouseholds: 66,
    unimprovedSanitationHouseholds: 37,
    makeshiftHousingHouseholds: 59,
    noElectricityHouseholds: 36,
    noInternetHouseholds: 289,
    disasterShockHouseholds: 177,
    indicatorCounts: {},
  },
  {
    barangayGeoCode: "1608506002",
    barangayName: "Cuarinta",
    totalHouseholds: 384,
    totalPopulation: 1710,
    totalMales: 875,
    totalFemales: 835,
    matchingHouseholds: 384,
    matchingRate: 100,
    poorHouseholds: 180,
    poorRate: 46.8,
    nearPoor5Households: 213,
    fourPsHouseholds: 135,
    fourPsRate: 35.2,
    no4psPoorHouseholds: 45,
    outOfSchoolYouthCount: 68,
    householdsWithOsy: 58,
    attendingSchoolCount: 245,
    nonLiterateCount: 29,
    tvetCount: 42,
    seniorCitizensCount: 120,
    householdsWithSenior: 96,
    pwdCount: 38,
    householdsWithPwd: 35,
    soloParentCount: 28,
    fisherfolkCount: 105,
    farmerCount: 74,
    unemployedCount: 52,
    underemployedCount: 89,
    ofwCount: 18,
    foodInsecureHouseholds: 97,
    unimprovedWaterHouseholds: 68,
    unimprovedSanitationHouseholds: 38,
    makeshiftHousingHouseholds: 61,
    noElectricityHouseholds: 67,
    noInternetHouseholds: 279,
    disasterShockHouseholds: 142,
    indicatorCounts: {},
  },
];

describe("Web-GIS Dashboard Visualizations & Anti-Clutter Analytics Transformations", () => {
  const mockChoroplethFeatures = MOCK_BARANGAY_REPORT_ROWS.map((r) => ({
    properties: {
      barangayGeoCode: r.barangayGeoCode,
      barangayName: r.barangayName,
      totalHouseholds: r.totalHouseholds,
      totalPopulation: r.totalPopulation,
      poorHouseholds: r.poorHouseholds,
      poor_rate: r.poorRate,
      near_poor_5_rate: Number((r.poorRate + 6.5).toFixed(1)),
      near_poor_10_rate: Number((r.poorRate + 11.2).toFixed(1)),
      near_poor_15_rate: Number((r.poorRate + 15.8).toFixed(1)),
      near_poor_20_rate: Number((r.poorRate + 19.4).toFixed(1)),
      near_poor_25_rate: Number((r.poorRate + 23.1).toFixed(1)),
      electricity_rate: 92.4,
      internet_rate: 51.2,
      beneficiary_4ps_rate: r.fourPsRate,
    },
  }));

  it("parses Barangay choropleth features and toggles cleanly between Normalized % Rate and Absolute HH Count (MAUP mitigation)", () => {
    const parsed = parseChoroplethFeatures(mockChoroplethFeatures);
    assert.equal(parsed.length, 2);

    const aurelio = parsed.find((b) => b.barangayGeoCode === "1608506001")!;
    assert.ok(aurelio);

    const rateVal = getMetricValueFromChoroplethRow(
      aurelio,
      "poor_rate",
      "rate",
    );
    const countVal = getMetricValueFromChoroplethRow(
      aurelio,
      "poor_rate",
      "count",
    );
    assert.equal(rateVal, aurelio.poor_rate);
    assert.equal(
      countVal,
      Math.round((aurelio.poor_rate / 100) * aurelio.totalHouseholds),
    );
  });

  it("builds the 10-Axis Multidimensional Deprivation Radar including Education (OSY) and Employment (Unemployed)", () => {
    const radarAll = build10AxisMpiRadarData(MOCK_BARANGAY_REPORT_ROWS, "ALL");
    assert.equal(radarAll.length, 10);

    const axisLabels = radarAll.map((d) => d.shortAxis);
    assert.deepEqual(axisLabels, [
      "Poverty",
      "OSY (Edu)",
      "Unemployed",
      "Hunger",
      "Water Gap",
      "Sanitation",
      "Housing",
      "No Power",
      "No Internet",
      "Disaster",
    ]);

    // When scoped to ALL, scopeRate equals municipalRate
    for (const axis of radarAll) {
      assert.equal(axis.scopeRate, axis.municipalRate);
      assert.ok(axis.municipalCount > 0);
    }

    // When cross-filtered to high-poverty Barangay Cuarinta (1608506002), poverty scopeRate exceeds municipalRate
    const radarCuarinta = build10AxisMpiRadarData(
      MOCK_BARANGAY_REPORT_ROWS,
      "1608506002",
    );
    const povertyAxis = radarCuarinta.find((a) => a.shortAxis === "Poverty")!;
    assert.ok(
      povertyAxis.scopeRate > povertyAxis.municipalRate,
      `Expected Cuarinta poverty rate (${povertyAxis.scopeRate}%) to exceed municipal average (${povertyAxis.municipalRate}%)`,
    );
  });

  it("builds monotonically non-decreasing Graduated Poverty & Shock-Vulnerability Buffer (+5% to +25%) curves", () => {
    const parsed = parseChoroplethFeatures(mockChoroplethFeatures);
    const curve = buildGraduatedPovertyCurveData(parsed, "1608506002");
    assert.equal(curve.length, 6);
    for (let i = 1; i < curve.length; i++) {
      assert.ok(
        curve[i]!.rate >= curve[i - 1]!.rate,
        `Expected threshold ${curve[i]!.shortLabel} (${curve[i]!.rate}%) >= ${curve[i - 1]!.shortLabel} (${curve[i - 1]!.rate}%)`,
      );
    }
  });

  it("builds Tab 2 Education (OSY, Literacy Gap, TVET) and Employment/Livelihood (Fisherfolk, Farmers, Unemployed, Underemployed) datasets", () => {
    const eduRates = buildEducationChartData(
      MOCK_BARANGAY_REPORT_ROWS,
      "rate",
    );
    const eduCounts = buildEducationChartData(
      MOCK_BARANGAY_REPORT_ROWS,
      "count",
    );
    assert.equal(eduRates.length, 2);
    assert.equal(eduCounts.length, 2);

    // Sorted descending by OSY value
    assert.ok(eduRates[0]!.osyValue >= eduRates[1]!.osyValue);
    assert.ok(eduCounts[0]!.osyCount > 0);
    assert.ok(eduCounts[0]!.nonLiterateCount > 0);
    assert.ok(eduCounts[0]!.tvetCount > 0);

    const livRates = buildLivelihoodChartData(
      MOCK_BARANGAY_REPORT_ROWS,
      "rate",
    );
    const livCounts = buildLivelihoodChartData(
      MOCK_BARANGAY_REPORT_ROWS,
      "count",
    );
    assert.equal(livRates.length, 2);
    assert.ok(livCounts[0]!.fisherfolkCount > 0);
    assert.ok(livCounts[0]!.farmerCount > 0);
    assert.ok(livCounts[0]!.unemployedCount > 0);
    assert.ok(livCounts[0]!.underemployedCount > 0);
    assert.ok(livCounts[0]!.ofwCount > 0);
  });

  it("builds Tab 3 4Ps Coverage Gap and Vulnerable Sector Bars with direct MapLibre filter deep-link IDs", () => {
    const gapData = buildFourPsGapChartData(
      MOCK_BARANGAY_REPORT_ROWS,
      "count",
    );
    assert.equal(gapData.length, 2);
    for (const row of gapData) {
      assert.equal(
        row.coveredPoorCount + row.unreachedPoorGapCount,
        row.totalPoorCount,
      );
    }

    const sectorBars = buildVulnerableSectorBars(
      MOCK_BARANGAY_REPORT_ROWS,
      "ALL",
      "rate",
    );
    assert.equal(sectorBars.length, 8);
    const seniorBar = sectorBars.find((b) => b.id === "senior_citizen")!;
    assert.equal(seniorBar.mapCriterion, "senior_citizen");
    assert.ok(seniorBar.count > 0);
    assert.ok(seniorBar.rate > 0);
  });

  it("aggregates Tab 4 GIS Reference Layers (CLUP Land Use ha, Road Condition km, Facility Sectors) and Longitudinal YoY Diverging Deltas", () => {
    const gis = aggregateGisInfrastructureData(
      [
        { properties: { luCategory: "Forestland", areaHectares: 1200.5 } },
        { properties: { luCategory: "Residential", areaHectares: 450.25 } },
      ],
      [
        { properties: { roadCondition: "Good", lengthMeters: 25400 } },
        { properties: { roadCondition: "Fair", lengthMeters: 12600 } },
      ],
      [
        { properties: { sectorCategory: "HEALTH_WELFARE" } },
        { properties: { sectorCategory: "HEALTH_WELFARE" } },
        { properties: { sectorCategory: "EDUCATION" } },
      ],
    );

    assert.equal(gis.landUseByCategory[0]!.category, "Forestland");
    assert.equal(gis.landUseByCategory[0]!.hectares, 1200.5);
    assert.equal(gis.roadsByCondition[0]!.condition, "Good");
    assert.equal(gis.roadsByCondition[0]!.lengthKm, 25.4);
    assert.equal(
      gis.facilitiesBySector.find((s) => s.id === "HEALTH_WELFARE")?.count,
      2,
    );

    // YoY Diverging Delta test: poverty reduction (-4.2%) is a positive outcome; internet gain (+10.5%) is a positive outcome
    const features2022 = [
      {
        properties: {
          barangayGeoCode: "1608506001",
          barangayName: "Aurelio",
          totalHouseholds: 580,
          poor_rate: 32.6,
          internet_rate: 42.3,
        },
      },
    ];
    const features2024 = [
      {
        properties: {
          barangayGeoCode: "1608506001",
          barangayName: "Aurelio",
          totalHouseholds: 612,
          poor_rate: 28.4,
          internet_rate: 52.8,
        },
      },
    ];

    const yoyPoor = buildYoYComparisonRows(
      features2022,
      features2024,
      "poor_rate",
    );
    assert.equal(yoyPoor.rows[0]!.delta, -4.2);
    assert.equal(yoyPoor.rows[0]!.isPositiveOutcome, true);

    const yoyNet = buildYoYComparisonRows(
      features2022,
      features2024,
      "internet_rate",
    );
    assert.equal(yoyNet.rows[0]!.delta, 10.5);
    assert.equal(yoyNet.rows[0]!.isPositiveOutcome, true);
  });
});
