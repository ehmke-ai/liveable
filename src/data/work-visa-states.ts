/**
 * Certified temporary-work positions by state of the primary worksite, fiscal year 2025.
 *
 * H-1B counts positions on Labor Condition Applications whose latest status is Certified.
 * H-2A and H-2B count workers on applications DOL certified, including partial certifications.
 * A worker on an application with several worksites is counted in the primary worksite's state.
 * Population is the Census Bureau's July 1, 2024 resident estimate.
 */
export type WorkVisaState = {
  abbr: string
  name: string
  /** Census resident population, July 1, 2024 */
  population: number
  /** Certified H-1B positions, primary worksite */
  h1b: number
  /** Certified H-2A workers, primary worksite */
  h2a: number
  /** Certified H-2B workers, primary worksite */
  h2b: number
}

export const workVisaStates: WorkVisaState[] = [
  { abbr: "AL", name: "Alabama", population: 5157699, h1b: 1900, h2a: 2084, h2b: 5216 },
  { abbr: "AK", name: "Alaska", population: 740133, h1b: 410, h2a: 46, h2b: 3206 },
  { abbr: "AZ", name: "Arizona", population: 7582384, h1b: 11943, h2a: 13935, h2b: 4354 },
  { abbr: "AR", name: "Arkansas", population: 3088354, h1b: 4317, h2a: 7865, h2b: 3396 },
  { abbr: "CA", name: "California", population: 39431263, h1b: 200886, h2a: 35138, h2b: 3518 },
  { abbr: "CO", name: "Colorado", population: 5957493, h1b: 8159, h2a: 4544, h2b: 10198 },
  { abbr: "CT", name: "Connecticut", population: 3675069, h1b: 9458, h2a: 1601, h2b: 424 },
  { abbr: "DE", name: "Delaware", population: 1051917, h1b: 2905, h2a: 1055, h2b: 514 },
  { abbr: "DC", name: "District of Columbia", population: 702250, h1b: 3438, h2a: 0, h2b: 41 },
  { abbr: "FL", name: "Florida", population: 23372215, h1b: 21516, h2a: 56818, h2b: 21482 },
  { abbr: "GA", name: "Georgia", population: 11180878, h1b: 25421, h2a: 42723, h2b: 6289 },
  { abbr: "HI", name: "Hawaii", population: 1446146, h1b: 298, h2a: 497, h2b: 355 },
  { abbr: "ID", name: "Idaho", population: 2001619, h1b: 1025, h2a: 7621, h2b: 4073 },
  { abbr: "IL", name: "Illinois", population: 12710158, h1b: 50280, h2a: 5757, h2b: 3111 },
  { abbr: "IN", name: "Indiana", population: 6924275, h1b: 7567, h2a: 5345, h2b: 3293 },
  { abbr: "IA", name: "Iowa", population: 3241488, h1b: 2708, h2a: 5364, h2b: 2484 },
  { abbr: "KS", name: "Kansas", population: 2970606, h1b: 2369, h2a: 2530, h2b: 1617 },
  { abbr: "KY", name: "Kentucky", population: 4588372, h1b: 2620, h2a: 7399, h2b: 2630 },
  { abbr: "LA", name: "Louisiana", population: 4597740, h1b: 2764, h2a: 14631, h2b: 8397 },
  { abbr: "ME", name: "Maine", population: 1405012, h1b: 500, h2a: 1490, h2b: 5264 },
  { abbr: "MD", name: "Maryland", population: 6263220, h1b: 10102, h2a: 1484, h2b: 4055 },
  { abbr: "MA", name: "Massachusetts", population: 7136171, h1b: 26626, h2a: 564, h2b: 5927 },
  { abbr: "MI", name: "Michigan", population: 10140459, h1b: 16170, h2a: 15984, h2b: 7817 },
  { abbr: "MN", name: "Minnesota", population: 5793151, h1b: 7286, h2a: 4356, h2b: 2794 },
  { abbr: "MS", name: "Mississippi", population: 2943045, h1b: 851, h2a: 7363, h2b: 4248 },
  { abbr: "MO", name: "Missouri", population: 6245466, h1b: 7465, h2a: 2466, h2b: 6150 },
  { abbr: "MT", name: "Montana", population: 1137233, h1b: 250, h2a: 2117, h2b: 2353 },
  { abbr: "NE", name: "Nebraska", population: 2005465, h1b: 1953, h2a: 4204, h2b: 1801 },
  { abbr: "NV", name: "Nevada", population: 3267467, h1b: 2028, h2a: 3780, h2b: 651 },
  { abbr: "NH", name: "New Hampshire", population: 1409032, h1b: 2673, h2a: 343, h2b: 1532 },
  { abbr: "NJ", name: "New Jersey", population: 9500851, h1b: 32712, h2a: 2718, h2b: 3438 },
  { abbr: "NM", name: "New Mexico", population: 2130256, h1b: 1603, h2a: 2511, h2b: 550 },
  { abbr: "NY", name: "New York", population: 19867248, h1b: 77822, h2a: 10658, h2b: 7093 },
  { abbr: "NC", name: "North Carolina", population: 11046024, h1b: 28166, h2a: 26123, h2b: 10215 },
  { abbr: "ND", name: "North Dakota", population: 796568, h1b: 526, h2a: 4754, h2b: 1689 },
  { abbr: "OH", name: "Ohio", population: 11883304, h1b: 15318, h2a: 4697, h2b: 7447 },
  { abbr: "OK", name: "Oklahoma", population: 4095393, h1b: 1576, h2a: 1455, h2b: 2589 },
  { abbr: "OR", name: "Oregon", population: 4272371, h1b: 6814, h2a: 4081, h2b: 5700 },
  { abbr: "PA", name: "Pennsylvania", population: 13078751, h1b: 18765, h2a: 3131, h2b: 7342 },
  { abbr: "RI", name: "Rhode Island", population: 1112308, h1b: 2004, h2a: 12, h2b: 1024 },
  { abbr: "SC", name: "South Carolina", population: 5478831, h1b: 3213, h2a: 6863, h2b: 6987 },
  { abbr: "SD", name: "South Dakota", population: 924669, h1b: 585, h2a: 3139, h2b: 2704 },
  { abbr: "TN", name: "Tennessee", population: 7227750, h1b: 8447, h2a: 6292, h2b: 6233 },
  { abbr: "TX", name: "Texas", population: 31290831, h1b: 124567, h2a: 15945, h2b: 22594 },
  { abbr: "UT", name: "Utah", population: 3503613, h1b: 12059, h2a: 1947, h2b: 5125 },
  { abbr: "VT", name: "Vermont", population: 648493, h1b: 874, h2a: 546, h2b: 1427 },
  { abbr: "VA", name: "Virginia", population: 8811195, h1b: 21708, h2a: 4534, h2b: 6238 },
  { abbr: "WA", name: "Washington", population: 7958180, h1b: 80594, h2a: 34560, h2b: 2574 },
  { abbr: "WV", name: "West Virginia", population: 1769979, h1b: 800, h2a: 346, h2b: 762 },
  { abbr: "WI", name: "Wisconsin", population: 5960975, h1b: 6184, h2a: 3036, h2b: 1725 },
  { abbr: "WY", name: "Wyoming", population: 587618, h1b: 240, h2a: 807, h2b: 1100 },
]

export const workVisaByAbbr: Record<string, WorkVisaState> = Object.fromEntries(
  workVisaStates.map((row) => [row.abbr, row])
)

export type WorkVisaProgram = "h1b" | "h2a" | "h2b"

export function workVisaTotal(key: WorkVisaProgram): number {
  return workVisaStates.reduce((sum, row) => sum + row[key], 0)
}

