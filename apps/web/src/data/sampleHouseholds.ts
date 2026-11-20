/**
 * Frontend-Only Sample CBMS Households, Members & Barangay Indicator Fallbacks
 * Location: Municipality of San Jose, Province of Dinagat Islands (PSGC 1608506)
 *
 * All [longitude, latitude] coordinates are verified inside the 12 actual PostGIS
 * barangay boundaries (`barangays.geom_boundary`) in `lgeo_cbms_db`.
 * Automatically yields to real database records once `CBMS_data.xlsx` is uploaded.
 */

export interface SampleHouseholdMember {
  lineNumber: string;
  firstName: string;
  lastName: string;
  sex: 'Male' | 'Female';
  age: number;
  relationToHead: string;
  isPwd: boolean;
  isSeniorCitizen: boolean;
  isSoloParent: boolean;
  attendingSchool: boolean;
  occupation: string;
}

export interface SampleHousehold {
  id: string;
  cbmsUuid: string;
  husn: string;
  hsn: string;
  barangayGeoCode: string;
  barangayName: string;
  sitioPurok: string;
  houseNumber: string;
  longitude: number;
  latitude: number;
  hhSize: number;
  poor: number; // 1 = Poor, 0 = Non-Poor
  nearPoor5: number; // 1 = Near-Poor (+5%), 0 = No
  electricity: number; // 1 = Yes, 0 = No
  internetAtHome: number; // 1 = Yes, 0 = No
  fourPsBeneficiary: number; // 1 = Yes, 0 = No
  roofMaterial: string;
  wallMaterial: string;
  drinkingWaterSource: string;
  evacuationCenterKnown: boolean;
  agreeToSignWaiver: boolean;
  members: readonly SampleHouseholdMember[];
}

export interface SampleBarangayIndicatorFallback {
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

interface BarangaySeedSpec {
  barangayGeoCode: string;
  barangayName: string;
  totalHouseholds2024: number;
  totalPopulation2024: number;
  poorRate2024: number;
  nearPoor5Rate2024: number;
  electricityRate2024: number;
  internetRate2024: number;
  fourPsRate2024: number;
  // 4 verified interior [longitude, latitude] points per barangay
  points: readonly (readonly [number, number])[];
}

const SAN_JOSE_BARANGAY_SPECS: readonly BarangaySeedSpec[] = [
  {
    barangayGeoCode: '1608506001',
    barangayName: 'Aurelio',
    totalHouseholds2024: 612,
    totalPopulation2024: 2685,
    poorRate2024: 28.4,
    nearPoor5Rate2024: 36.2,
    electricityRate2024: 94.1,
    internetRate2024: 52.8,
    fourPsRate2024: 24.5,
    points: [
      [125.57744, 10.00727],
      [125.57685, 10.00645],
      [125.57842, 10.00812],
      [125.57965, 10.00695],
    ],
  },
  {
    barangayGeoCode: '1608506002',
    barangayName: 'Cuarinta',
    totalHouseholds2024: 384,
    totalPopulation2024: 1710,
    poorRate2024: 46.8,
    nearPoor5Rate2024: 55.4,
    electricityRate2024: 82.6,
    internetRate2024: 27.3,
    fourPsRate2024: 41.9,
    points: [
      [125.61166, 10.0171],
      [125.6084, 10.0156],
      [125.6142, 10.0189],
      [125.6168, 10.0162],
    ],
  },
  {
    barangayGeoCode: '1608506003',
    barangayName: 'Don Ruben',
    totalHouseholds2024: 745,
    totalPopulation2024: 3210,
    poorRate2024: 24.6,
    nearPoor5Rate2024: 31.8,
    electricityRate2024: 95.8,
    internetRate2024: 58.4,
    fourPsRate2024: 21.2,
    points: [
      [125.58447, 10.01266],
      [125.5819, 10.0118],
      [125.5867, 10.0135],
      [125.5889, 10.0121],
    ],
  },
  {
    barangayGeoCode: '1608506004',
    barangayName: 'Jacquez',
    totalHouseholds2024: 428,
    totalPopulation2024: 1840,
    poorRate2024: 21.5,
    nearPoor5Rate2024: 28.9,
    electricityRate2024: 96.7,
    internetRate2024: 64.2,
    fourPsRate2024: 18.7,
    points: [
      [125.57396, 10.00572],
      [125.5728, 10.0053],
      [125.5746, 10.0062],
      [125.5734, 10.0064],
    ],
  },
  {
    barangayGeoCode: '1608506005',
    barangayName: 'Justiniana Edera',
    totalHouseholds2024: 590,
    totalPopulation2024: 2540,
    poorRate2024: 25.9,
    nearPoor5Rate2024: 33.4,
    electricityRate2024: 95.2,
    internetRate2024: 56.1,
    fourPsRate2024: 23.1,
    points: [
      [125.57789, 10.01218],
      [125.5762, 10.0115],
      [125.5791, 10.0128],
      [125.5804, 10.0119],
    ],
  },
  {
    barangayGeoCode: '1608506006',
    barangayName: 'Luna',
    totalHouseholds2024: 518,
    totalPopulation2024: 2295,
    poorRate2024: 38.6,
    nearPoor5Rate2024: 47.1,
    electricityRate2024: 88.9,
    internetRate2024: 36.8,
    fourPsRate2024: 34.0,
    points: [
      [125.59942, 9.99996],
      [125.5968, 10.0014],
      [125.6018, 9.9987],
      [125.6039, 10.0021],
    ],
  },
  {
    barangayGeoCode: '1608506007',
    barangayName: 'Mahayahay',
    totalHouseholds2024: 564,
    totalPopulation2024: 2475,
    poorRate2024: 32.8,
    nearPoor5Rate2024: 41.0,
    electricityRate2024: 91.4,
    internetRate2024: 45.6,
    fourPsRate2024: 28.9,
    points: [
      [125.58786, 10.00568],
      [125.5854, 10.0048],
      [125.5896, 10.0067],
      [125.5912, 10.0042],
    ],
  },
  {
    barangayGeoCode: '1608506008',
    barangayName: 'Matingbe',
    totalHouseholds2024: 492,
    totalPopulation2024: 2180,
    poorRate2024: 35.2,
    nearPoor5Rate2024: 43.8,
    electricityRate2024: 90.1,
    internetRate2024: 42.3,
    fourPsRate2024: 30.5,
    points: [
      [125.58421, 9.99822],
      [125.5815, 9.9994],
      [125.5861, 9.9971],
      [125.5789, 10.0008],
    ],
  },
  {
    barangayGeoCode: '1608506009',
    barangayName: 'Poblacion',
    totalHouseholds2024: 860,
    totalPopulation2024: 3640,
    poorRate2024: 13.8,
    nearPoor5Rate2024: 19.5,
    electricityRate2024: 98.6,
    internetRate2024: 76.4,
    fourPsRate2024: 13.2,
    points: [
      [125.57154, 10.00892],
      [125.5708, 10.0081],
      [125.5724, 10.0096],
      [125.5731, 10.0084],
    ],
  },
  {
    barangayGeoCode: '1608506010',
    barangayName: 'San Juan',
    totalHouseholds2024: 640,
    totalPopulation2024: 2730,
    poorRate2024: 17.9,
    nearPoor5Rate2024: 24.6,
    electricityRate2024: 97.4,
    internetRate2024: 69.5,
    fourPsRate2024: 16.4,
    points: [
      [125.57044, 10.01155],
      [125.5698, 10.0109],
      [125.5712, 10.0121],
      [125.5716, 10.0111],
    ],
  },
  {
    barangayGeoCode: '1608506011',
    barangayName: 'Sta Cruz',
    totalHouseholds2024: 790,
    totalPopulation2024: 3420,
    poorRate2024: 19.8,
    nearPoor5Rate2024: 27.2,
    electricityRate2024: 96.3,
    internetRate2024: 63.8,
    fourPsRate2024: 18.1,
    points: [
      [125.57586, 10.01756],
      [125.5742, 10.0158],
      [125.5784, 10.0189],
      [125.5812, 10.0167],
    ],
  },
  {
    barangayGeoCode: '1608506012',
    barangayName: 'Wilson',
    totalHouseholds2024: 445,
    totalPopulation2024: 1985,
    poorRate2024: 42.9,
    nearPoor5Rate2024: 51.6,
    electricityRate2024: 84.5,
    internetRate2024: 30.8,
    fourPsRate2024: 38.2,
    points: [
      [125.59331, 10.03089],
      [125.5904, 10.0282],
      [125.5958, 10.0334],
      [125.5882, 10.0256],
    ],
  },
];

const SURNAMES = [
  'Dela Cruz',
  'Ecleo',
  'Reyes',
  'Santos',
  'Mendoza',
  'Villanueva',
  'Bautista',
  'Fernandez',
  'Ramos',
  'Navarro',
  'Castillo',
  'Aquino',
];

const FIRST_NAMES_MALE = ['Ricardo', 'Roberto', 'Eduardo', 'Marlon', 'Arnel', 'Danilo', 'Reynaldo', 'Jerome'];
const FIRST_NAMES_FEMALE = ['Maria', 'Elena', 'Rosario', 'Evelyn', 'Marites', 'Lorna', 'Grace', 'Teresita'];
const PUROK_LABELS = ['Purok 1 (Centro)', 'Purok 2 (Seaside)', 'Purok 3 (Hilltop)', 'Purok 4 (Bagong Silang)'];

export const SAMPLE_HOUSEHOLDS: readonly SampleHousehold[] = SAN_JOSE_BARANGAY_SPECS.flatMap(
  (brgy, bIdx) =>
    brgy.points.map(([lng, lat], pIdx) => {
      const globalIdx = bIdx * 4 + pIdx + 1;
      const isPoor = pIdx === 0 || (pIdx === 1 && brgy.poorRate2024 >= 32) ? 1 : 0;
      const isNearPoor5 = isPoor === 1 || pIdx === 2 ? 1 : 0;
      const hasElec = isPoor === 1 && pIdx === 0 && brgy.electricityRate2024 < 90 ? 0 : 1;
      const hasInternet = isPoor === 0 && pIdx >= 2 ? 1 : 0;
      const is4Ps = isPoor === 1 ? 1 : 0;
      const hhSize = 3 + ((globalIdx + pIdx) % 4);
      const lastName = SURNAMES[(bIdx + pIdx) % SURNAMES.length]!;
      const husn = `${brgy.barangayGeoCode.slice(-3)}-00${pIdx + 1}`;
      const hsn = `${brgy.barangayGeoCode.slice(-3)}-00${pIdx + 1}-01`;

      const members: SampleHouseholdMember[] = Array.from({ length: hhSize }, (_, mIdx) => {
        const isMale = mIdx === 0 ? true : mIdx === 1 ? false : mIdx % 2 === 0;
        const age =
          mIdx === 0
            ? 38 + ((bIdx * 3 + pIdx * 5) % 28)
            : mIdx === 1
              ? 35 + ((bIdx * 3 + pIdx * 4) % 25)
              : 6 + ((mIdx * 4 + pIdx * 3) % 16);
        return {
          lineNumber: String(mIdx + 1).padStart(2, '0'),
          firstName: isMale
            ? FIRST_NAMES_MALE[(globalIdx + mIdx) % FIRST_NAMES_MALE.length]!
            : FIRST_NAMES_FEMALE[(globalIdx + mIdx) % FIRST_NAMES_FEMALE.length]!,
          lastName,
          sex: isMale ? 'Male' : 'Female',
          age,
          relationToHead: mIdx === 0 ? 'Head' : mIdx === 1 ? 'Spouse' : 'Child',
          isPwd: mIdx === 0 && globalIdx % 7 === 0,
          isSeniorCitizen: age >= 60,
          isSoloParent: mIdx === 0 && hhSize === 3 && pIdx === 1,
          attendingSchool: age >= 5 && age <= 21,
          occupation:
            mIdx === 0
              ? isPoor
                ? 'Fisherfolk / Seasonal Farm Worker'
                : 'Municipal Employee / Retail Trade'
              : mIdx === 1
                ? 'Sari-Sari Store / Homemaker'
                : 'Student',
        };
      });

      return {
        id: `hh-${brgy.barangayGeoCode}-${pIdx + 1}`,
        cbmsUuid: `cb002024-${brgy.barangayGeoCode.slice(-3)}0-4000-8000-${String(globalIdx).padStart(12, '0')}`,
        husn,
        hsn,
        barangayGeoCode: brgy.barangayGeoCode,
        barangayName: brgy.barangayName,
        sitioPurok: PUROK_LABELS[pIdx % PUROK_LABELS.length]!,
        houseNumber: `Blk ${pIdx + 1} Lot ${(globalIdx % 12) + 1}`,
        longitude: lng,
        latitude: lat,
        hhSize,
        poor: isPoor,
        nearPoor5: isNearPoor5,
        electricity: hasElec,
        internetAtHome: hasInternet,
        fourPsBeneficiary: is4Ps,
        roofMaterial: isPoor ? 'Light Material (Nipa / Cogon)' : 'Strong Material (Galvanized Iron)',
        wallMaterial: isPoor ? 'Light Material (Bamboo / Sawali)' : 'Strong Material (Concrete / Brick)',
        drinkingWaterSource: isPoor ? 'Level II Communal Faucet / Spring' : 'Level III Piped Water Supply',
        evacuationCenterKnown: true,
        agreeToSignWaiver: true,
        members,
      };
    }),
);

export function getSampleBarangayIndicators(
  surveyYear: number,
): Record<string, SampleBarangayIndicatorFallback> {
  const is2022 = surveyYear === 2022;
  const map: Record<string, SampleBarangayIndicatorFallback> = {};

  for (const spec of SAN_JOSE_BARANGAY_SPECS) {
    const totalHouseholds = is2022
      ? Math.round(spec.totalHouseholds2024 * 0.94)
      : spec.totalHouseholds2024;
    const totalPopulation = is2022
      ? Math.round(spec.totalPopulation2024 * 0.95)
      : spec.totalPopulation2024;
    const poor_rate = Number(
      (is2022 ? Math.min(62, spec.poorRate2024 + 4.3) : spec.poorRate2024).toFixed(1),
    );
    const near_poor_5_rate = Number(
      (is2022 ? Math.min(70, spec.nearPoor5Rate2024 + 4.5) : spec.nearPoor5Rate2024).toFixed(1),
    );
    const near_poor_10_rate = Number(Math.min(78, near_poor_5_rate + 4.2).toFixed(1));
    const near_poor_15_rate = Number(Math.min(84, near_poor_10_rate + 3.8).toFixed(1));
    const near_poor_20_rate = Number(Math.min(89, near_poor_15_rate + 3.5).toFixed(1));
    const near_poor_25_rate = Number(Math.min(93, near_poor_20_rate + 3.1).toFixed(1));
    const electricity_rate = Number(
      (is2022 ? Math.max(72, spec.electricityRate2024 - 3.6) : spec.electricityRate2024).toFixed(1),
    );
    const internet_rate = Number(
      (is2022 ? Math.max(18, spec.internetRate2024 - 9.4) : spec.internetRate2024).toFixed(1),
    );
    const beneficiary_4ps_rate = Number(
      (is2022 ? spec.fourPsRate2024 + 1.8 : spec.fourPsRate2024).toFixed(1),
    );
    const poorHouseholds = Math.round((poor_rate / 100) * totalHouseholds);

    map[spec.barangayGeoCode] = {
      barangayGeoCode: spec.barangayGeoCode,
      barangayName: spec.barangayName,
      totalHouseholds,
      totalPopulation,
      poorHouseholds,
      poor_rate,
      near_poor_5_rate,
      near_poor_10_rate,
      near_poor_15_rate,
      near_poor_20_rate,
      near_poor_25_rate,
      electricity_rate,
      internet_rate,
      beneficiary_4ps_rate,
    };
  }

  return map;
}
