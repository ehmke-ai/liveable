/**
 * Temporary work-visa counts from three official series that do not measure the same thing.
 *
 * Issuances are State Department visa stamps (Table XV(B)). Canadians are usually visa-exempt
 * for H-1B, L-1, and TN, and extensions inside the United States get no new stamp.
 *
 * H-1B approvals are USCIS petition decisions, including extensions and transfers. The cap is
 * 85,000 new cap-subject slots a year; most approvals are continuing employment.
 *
 * LCA positions are Department of Labor certifications that an employer may hire an H-1B,
 * H-1B1, or E-3 worker. Employers file more slots than they fill.
 */

export const ISSUANCE_YEARS = [2020, 2021, 2022, 2023, 2024] as const

export type WorkVisaClass = {
  code: string
  label: string
  /** Visas issued, aligned with ISSUANCE_YEARS */
  issued: readonly number[]
  cap: string
  /** Drawn on the issuance chart */
  chart?: { color: string }
}

/** Principal worker classifications, largest FY 2024 issuance first. */
export const workVisaClasses: WorkVisaClass[] = [
  {
    code: "H-2A",
    label: "Agricultural worker",
    issued: [213394, 257898, 298336, 310676, 315328],
    cap: "No annual cap",
    chart: { color: "#15803d" },
  },
  {
    code: "H-1B",
    label: "Specialty occupation",
    issued: [124983, 61569, 206002, 265777, 219659],
    cap: "85,000 new cap-subject slots (65,000 + 20,000 with a U.S. advanced degree). Universities and related nonprofits are cap-exempt. Extensions do not use a new slot.",
    chart: { color: "#1d4ed8" },
  },
  {
    code: "H-2B",
    label: "Seasonal non-agricultural worker",
    issued: [61865, 95053, 124644, 131704, 139541],
    cap: "66,000 statutory, plus supplemental visas in recent years",
    chart: { color: "#b45309" },
  },
  {
    code: "L-1",
    label: "Intracompany transferee",
    issued: [35942, 24863, 72958, 76671, 71799],
    cap: "No annual cap",
    chart: { color: "#7c3aed" },
  },
  {
    code: "O-1",
    label: "Extraordinary ability",
    issued: [8838, 7294, 19102, 18994, 19457],
    cap: "No annual cap",
    chart: { color: "#be123c" },
  },
  {
    code: "TN",
    label: "USMCA professional (Mexico and Canada)",
    issued: [13771, 24903, 33361, 32904, 15672],
    cap: "No annual cap. Most Canadians apply at the border and never receive a visa stamp.",
    chart: { color: "#0f766e" },
  },
  {
    code: "R-1",
    label: "Religious worker",
    issued: [1732, 1942, 4098, 5330, 5186],
    cap: "No annual cap",
  },
  {
    code: "E-3",
    label: "Australian specialty occupation",
    issued: [3144, 2309, 4731, 4434, 3933],
    cap: "10,500",
  },
  {
    code: "E-3R",
    label: "Returning Australian specialty worker",
    issued: [1775, 1092, 2631, 2410, 3100],
    cap: "Counts against the E-3 limit",
  },
  {
    code: "H-1B1",
    label: "Chile and Singapore specialty worker",
    issued: [1083, 1586, 2376, 3039, 3070],
    cap: "1,400 Chile + 5,400 Singapore",
  },
]

/** Spouses and children. H-4, L-2, and E-3D can include people with work authorization. */
export const dependentVisaClasses: WorkVisaClass[] = [
  {
    code: "H-4",
    label: "Spouse or child of H-1B, H-1B1, H-2, or H-3",
    issued: [66323, 55444, 137246, 186748, 139874],
    cap: "No separate cap. Some H-4 spouses can get an employment card.",
  },
  {
    code: "L-2",
    label: "Spouse or child of L-1",
    issued: [35710, 30354, 78448, 83277, 73317],
    cap: "L-2 spouses are work-authorized incident to status.",
  },
  {
    code: "TD",
    label: "Spouse or child of TN",
    issued: [6055, 11920, 16575, 17600, 12199],
    cap: "Not work-authorized",
  },
  {
    code: "O-3",
    label: "Spouse or child of O-1 or O-2",
    issued: [2658, 2838, 6234, 6453, 6035],
    cap: "Not work-authorized",
  },
  {
    code: "E-3D",
    label: "Spouse or child of E-3",
    issued: [2267, 1623, 3292, 3759, 3574],
    cap: "E-3 spouses can work.",
  },
]

export function issuedIn(row: WorkVisaClass, year: number): number {
  const index = ISSUANCE_YEARS.indexOf(year as (typeof ISSUANCE_YEARS)[number])
  if (index < 0) throw new Error(`No issuance year ${year}`)
  return row.issued[index]
}

export function issuanceTotal(year: number, rows: WorkVisaClass[] = workVisaClasses): number {
  return rows.reduce((sum, row) => sum + issuedIn(row, year), 0)
}

export const chartedVisaClasses = workVisaClasses.filter((row) => row.chart)

export type H1bBirthplace = {
  country: string
  approvals: number
}

/** USCIS Characteristics of H-1B Specialty Occupation Workers, FY 2025, Figure 1. */
export const H1B_FY2025_APPROVALS = 406_348

export const h1bByBirth: H1bBirthplace[] = [
  { country: "India", approvals: 283_772 },
  { country: "China", approvals: 49_161 },
  { country: "Philippines", approvals: 5_546 },
  { country: "Canada", approvals: 4_382 },
  { country: "South Korea", approvals: 4_195 },
  { country: "Mexico", approvals: 3_390 },
  { country: "Pakistan", approvals: 3_380 },
  { country: "Taiwan", approvals: 3_161 },
  { country: "Brazil", approvals: 2_876 },
  { country: "Nigeria", approvals: 2_420 },
]

export const h1bBirthOther =
  H1B_FY2025_APPROVALS - h1bByBirth.reduce((sum, row) => sum + row.approvals, 0)

/** FY 2025 Table 1b / 1c. Initial plus continuing equals the annual total. */
export const h1bByPetitionType = [
  { label: "Initial employment", approvals: 114_806, indiaShare: 50.3, chinaShare: 15.4 },
  { label: "Continuing employment", approvals: 291_542, indiaShare: 77.6, chinaShare: 10.8 },
] as const

/** FY 2025 Table 2. Counts sum to H1B_FY2025_APPROVALS. */
export const h1bByEducation = [
  { level: "Master's", approvals: 233_779 },
  { level: "Bachelor's", approvals: 123_824 },
  { level: "Doctorate", approvals: 33_090 },
  { level: "Professional", approvals: 14_934 },
  { level: "Below a bachelor's", approvals: 381 },
  { level: "Unknown", approvals: 340 },
] as const

export type PetitionClass = {
  code: string
  label: string
  received: number
  approved: number
  denied: number
}

/**
 * USCIS Form I-129, initial decisions, October 1, 2025–June 30, 2026.
 * One H-2A or H-2B petition can name many workers. An H-1B petition is usually one worker.
 * L-1A and L-1B exclude blanket L petitions, which are listed separately.
 */
export const PETITION_PERIOD = "October 1, 2025 – June 30, 2026"

export const petitionClasses: PetitionClass[] = [
  { code: "H-1B", label: "Specialty occupation", received: 312_830, approved: 270_419, denied: 8_231 },
  { code: "H-2A", label: "Agricultural worker", received: 27_233, approved: 25_926, denied: 499 },
  { code: "O", label: "Extraordinary ability and support", received: 25_722, approved: 21_321, denied: 2_096 },
  { code: "L-1A", label: "Intracompany manager or executive", received: 20_766, approved: 16_929, denied: 1_624 },
  { code: "H-2B", label: "Seasonal non-agricultural worker", received: 12_832, approved: 12_535, denied: 160 },
  { code: "TN", label: "USMCA professional", received: 12_411, approved: 10_775, denied: 574 },
  { code: "L-1B", label: "Intracompany specialized knowledge", received: 11_296, approved: 9_367, denied: 896 },
  { code: "R-1", label: "Religious worker", received: 7_963, approved: 6_600, denied: 281 },
  { code: "P", label: "Athlete, artist, or entertainer", received: 7_599, approved: 6_589, denied: 614 },
  { code: "Blanket L", label: "Blanket intracompany petition", received: 998, approved: 971, denied: 19 },
]

export function approvalRate(row: PetitionClass): number {
  const completed = row.approved + row.denied
  return completed === 0 ? 0 : row.approved / completed
}

export type LcaRank = { name: string; positions: number }

/** DOL OFLC LCA selected statistics, FY 2025. Certified positions, not unique people. */
export const LCA_FY2025_POSITIONS = 910_968
export const LCA_FY2025_CERTIFIED_APPLICATIONS = 561_505

export const lcaTopStates: LcaRank[] = [
  { name: "California", positions: 207_310 },
  { name: "Texas", positions: 127_136 },
  { name: "Washington", positions: 83_842 },
  { name: "New York", positions: 82_278 },
  { name: "Illinois", positions: 51_389 },
  { name: "New Jersey", positions: 33_486 },
  { name: "North Carolina", positions: 28_715 },
  { name: "Massachusetts", positions: 27_606 },
  { name: "Georgia", positions: 26_301 },
  { name: "Florida", positions: 23_213 },
]

export const lcaTopOccupations: LcaRank[] = [
  { name: "Software developers", positions: 286_287 },
  { name: "IT project managers", positions: 35_853 },
  { name: "Computer systems engineers", positions: 33_822 },
  { name: "Physical therapists", positions: 32_815 },
  { name: "Electronics engineers", positions: 32_434 },
  { name: "Software QA analysts and testers", positions: 28_529 },
  { name: "Data scientists", positions: 28_070 },
  { name: "Occupational therapists", positions: 26_606 },
  { name: "Computer and information systems managers", positions: 23_165 },
  { name: "Business intelligence analysts", positions: 19_665 },
]

export const lcaTopEmployers: LcaRank[] = [
  { name: "Amazon.com Services LLC", positions: 60_036 },
  { name: "Grandison Management, Inc.", positions: 57_840 },
  { name: "NVIDIA Corporation", positions: 45_712 },
  { name: "Microsoft Corporation", positions: 20_686 },
  { name: "Oracle America, Inc.", positions: 17_948 },
  { name: "Infosys Limited", positions: 16_328 },
  { name: "Amazon Web Services, Inc.", positions: 15_935 },
  { name: "Apple, Inc.", positions: 14_316 },
  { name: "Cisco Systems, Inc.", positions: 13_609 },
  { name: "Goldman Sachs & Co. LLC", positions: 11_279 },
]

export function formatCount(value: number): string {
  return value.toLocaleString("en-US")
}

export function formatShare(part: number, whole: number): string {
  return `${((part / whole) * 100).toFixed(1)}%`
}

export const workVisaSources = [
  {
    label: "Visa issuances, FY 2020–2024",
    detail:
      "U.S. Department of State, Report of the Visa Office 2024, Table XV(B). Principal worker symbols are H-1B, H-1B1, H-2A, H-2B, L-1, O-1, E-3, E-3R, TN, and R-1. Dependent symbols are H-4, L-2, O-3, TD, and E-3D. Posts cut routine visa services in March 2020 and restored them gradually, so FY 2020 and FY 2021 are low.",
    url: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-statistics/nonimmigrant-visa-statistics.html",
  },
  {
    label: "H-1B approvals by country of birth, FY 2025",
    detail:
      "USCIS, Characteristics of H-1B Specialty Occupation Workers, Fiscal Year 2025 (April 24, 2026). Country counts are Figure 1. The report’s total is 406,348. Figure 1’s “other” line is 43,628; the ten countries in Figure 1 plus that line fall 437 short of the total, and Table 1a lists India at 284,106 rather than 283,772. This page keeps Figure 1’s country counts and puts the residual in “all other.” Initial and continuing employment are Tables 1b and 1c. Education is Table 2.",
    url: "https://www.uscis.gov/sites/default/files/document/data/fy25_h1b_characteristics_congress_signed_04242026.pdf",
  },
  {
    label: "Petition decisions, FY 2026 through June",
    detail:
      "USCIS, Nonimmigrant Worker Petitions by Case Status and Request for Evidence, Fiscal Year 2026 Quarter 3. Initial approvals and denials only. Includes extensions. Queried July 2026.",
    url: "https://www.uscis.gov/sites/default/files/document/data/i129_quarterly_request_for_evidence_fy2026_q3_v1.xlsx",
  },
  {
    label: "Certified specialty-occupation positions, FY 2025",
    detail:
      "Department of Labor, Office of Foreign Labor Certification, LCA (H-1B, H-1B1, and E-3) Selected Statistics, FY 2025. Positions certified, by state of employment, occupation, and employer. Not a count of people admitted.",
    url: "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/LCA_Selected_Statistics_FY2025_Q4.pdf",
  },
  {
    label: "State map, FY 2025",
    detail:
      "Department of Labor, OFLC public disclosure files. H-1B positions are TOTAL_WORKER_POSITIONS on Labor Condition Applications whose latest status is Certified, visa class H-1B, summed across the four FY 2025 quarterly files with duplicate case numbers kept once. H-2A workers are TOTAL_WORKERS_H2A_CERTIFIED and H-2B workers are TOTAL_WORKERS_CERTIFIED on FY 2025 determinations whose status contains Certification, including partial and returned certifications. Each application is assigned to WORKSITE_STATE, the primary worksite, so additional worksites are not split out. Puerto Rico and other territories are left off the map. The 50 states and D.C. sum to 880,465 H-1B positions, 397,259 H-2A workers, and 231,746 H-2B workers. DOL’s selected statistics, which use a slightly different cut, publish 910,968 certified H-1B, H-1B1, and E-3 positions and 398,258 H-2A workers. Population is the Census Bureau’s July 1, 2024 state resident estimate, table NST-EST2024-POP.",
    url: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
  },
] as const
