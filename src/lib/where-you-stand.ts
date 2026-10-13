import fieldCitizenship from "@/data/field-citizenship.json"

import {
  POPULATION_GROUP_LABELS,
  type PopulationGroup,
} from "@/lib/states"

/** SOC major groups that show up in DOL job-visa filings. Anything else is Other. */
export const WORK_FIELDS = [
  { id: "computer", label: "Software and computing" },
  { id: "engineering", label: "Engineering and architecture" },
  { id: "healthcare", label: "Healthcare practitioners" },
  { id: "healthSupport", label: "Healthcare support" },
  { id: "business", label: "Business and finance" },
  { id: "management", label: "Management" },
  { id: "education", label: "Education" },
  { id: "science", label: "Science" },
  { id: "legal", label: "Law" },
  { id: "arts", label: "Arts, design, and media" },
  { id: "sales", label: "Sales" },
  { id: "office", label: "Office and administrative" },
  { id: "agriculture", label: "Agriculture" },
  { id: "grounds", label: "Landscaping, janitorial, and grounds" },
  { id: "construction", label: "Construction" },
  { id: "food", label: "Restaurant and food service" },
  { id: "production", label: "Manufacturing" },
  { id: "transport", label: "Transportation" },
  { id: "maintenance", label: "Installation and repair" },
  { id: "personal", label: "Personal care and service" },
  { id: "other", label: "Other" },
] as const

export type WorkFieldId = (typeof WORK_FIELDS)[number]["id"]

/** Hide a state share below this many employed respondents in the field. */
export const MIN_FIELD_SAMPLE = 80

export type FieldLabor = {
  citizen: number
  naturalized: number
  noncitizen: number
  n: number
}

type FieldLaborFile = {
  year: number
} & Record<string, Record<string, FieldLabor> | number>

const laborFile = fieldCitizenship as FieldLaborFile

export const FIELD_CITIZENSHIP_YEAR = laborFile.year

export function fieldLabor(abbr: string, fieldId: WorkFieldId): FieldLabor | undefined {
  const row = laborFile[abbr]
  if (!row || typeof row !== "object") return undefined
  return row[fieldId]
}

/** Programs in county-visa-fields.json. Order is the order of the breakdown. */
export const VISA_PROGRAMS = [
  { id: "h1b", label: "H-1B" },
  { id: "specialty", label: "H-1B1 and E-3" },
  { id: "perm", label: "Green-card labor certification" },
  { id: "h2a", label: "H-2A" },
  { id: "h2b", label: "H-2B" },
] as const

export type VisaProgramId = (typeof VISA_PROGRAMS)[number]["id"]

export function workField(id: string | null): (typeof WORK_FIELDS)[number] | undefined {
  return WORK_FIELDS.find((field) => field.id === id)
}

export const DEMOGRAPHIC_GROUPS = (
  Object.keys(POPULATION_GROUP_LABELS) as PopulationGroup[]
).map((id) => ({ id, label: POPULATION_GROUP_LABELS[id] }))

/**
 * Ages in 2024. The Federal Reserve still publishes one wealth line for everyone
 * born in 1981 or later, so Millennial, Gen Z, and Gen Alpha share `fed`.
 */
export const GENERATIONS = [
  { id: "silent", label: "Silent", born: "born before 1946", fed: "silent", ages: "79 and older" },
  { id: "boomer", label: "Boomer", born: "born 1946–1964", fed: "boomer", ages: "60–78" },
  { id: "genx", label: "Gen X", born: "born 1965–1980", fed: "genx", ages: "44–59" },
  { id: "millennial", label: "Millennial", born: "born 1981–1996", fed: "younger", ages: "28–43" },
  { id: "genz", label: "Gen Z", born: "born 1997–2012", fed: "younger", ages: "12–27" },
  { id: "alpha", label: "Gen Alpha", born: "born 2013 or later", fed: "younger", ages: "11 and under" },
] as const

export type GenerationId = (typeof GENERATIONS)[number]["id"]
export type FedWealthId = (typeof GENERATIONS)[number]["fed"]

export function generation(id: string | null): (typeof GENERATIONS)[number] | undefined {
  return GENERATIONS.find((row) => row.id === id)
}

/** Share of U.S. household net worth, Federal Reserve DFA, 2026 Q2. */
export const WEALTH_QUARTER = "2026 Q2"

export const FED_WEALTH = [
  { id: "silent", label: "Silent and earlier", born: "born before 1946", share: 10.7 },
  { id: "boomer", label: "Baby boomers", born: "born 1946–1964", share: 52.5 },
  { id: "genx", label: "Generation X", born: "born 1965–1980", share: 25.7 },
  { id: "younger", label: "Millennial and younger", born: "born 1981 or later", share: 11.2 },
] as const

export function fedWealth(id: FedWealthId): (typeof FED_WEALTH)[number] {
  const row = FED_WEALTH.find((item) => item.id === id)
  if (!row) throw new Error(`No wealth group ${id}`)
  return row
}

export const whereYouStandSources = [
  {
    label: `Workers by citizenship and field, ${FIELD_CITIZENSHIP_YEAR}`,
    detail: `American Community Survey ${FIELD_CITIZENSHIP_YEAR} 1-year Public Use Microdata Sample. Civilian employed people age 16 and over, weighted by person weight, grouped by the occupation’s SOC major group. Citizens are people born in the United States, born in a U.S. territory, born abroad of American parents, or naturalized. The naturalized count is the naturalized part of the citizen count. Non-citizens include green-card holders, temporary workers, refugees, and people without status who answered the survey. The survey records citizenship and has no visa class. A state share is hidden when fewer than ${MIN_FIELD_SAMPLE} respondents in that state and field are employed. These are workers, not jobs, and they are separate from the county filing counts. Puerto Rico is not included.`,
    url: "https://www.census.gov/programs-surveys/acs/microdata/documentation/2024.html",
  },
  {
    label: "College and university job visas, FY 2025",
    detail:
      "Department of Labor, OFLC disclosure files, FY 2025. Employers whose NAICS code starts with 6112 (junior colleges) or 6113 (colleges, universities, and professional schools). H-1B, H-1B1, and E-3 positions come from the LCA files, Q1–Q4, latest status Certified, counted with the same case rules as the county file. Green-card labor certifications are certified PERM applications, one worker each. Each tax ID is a separate employer, so campuses that file apart stay apart. A certified slot is not a person admitted. University hospitals that file under a hospital industry code are not included. J-1 scholars, Optional Practical Training, TN, and O-1 are not in these files.",
    url: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
  },
  {
    label: "Job visas by county and field, FY 2025",
    detail:
      "Department of Labor, OFLC disclosure files, FY 2025. H-1B, H-1B1, and E-3 positions come from the LCA files, Q1–Q4. H-2A and H-2B workers come from the full-year files and include partial certifications. Duplicate case numbers are kept once and counted at the primary worksite county. The field is the occupation’s SOC major group. A certified slot is not a person admitted, and the same worker can be certified under more than one program in the same year. L-1, TN, O-1, and student work permits are not in these files.",
    url: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
  },
  {
    label: "Green-card labor certifications, FY 2025",
    detail:
      "Department of Labor PERM disclosure, FY 2025. Certified applications, including those later marked expired, counted once at the primary worksite. One application is one worker. This is the labor-certification step for an employment green card. Green cards that skip this step, including EB-1 and national-interest waivers, are not included. Family and asylum immigration is not tied to a job and is not included.",
    url: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
  },
  {
    label: "County population share, 1990–2025",
    detail:
      "The same county series as the ethnicity maps. Indian, East Asian, and Arab shares start in 2000. Connecticut’s 2025 figures are planning regions, so its eight counties stop at 2020.",
    url: "https://www.census.gov/programs-surveys/popest.html",
  },
  {
    label: "Wealth by generation, 2026 Q2",
    detail:
      "Federal Reserve Distributional Financial Accounts, distribution of household net worth by generation, 2026 Q2. Silent and earlier 10.7%, baby boomers 52.5%, Generation X 25.7%, and everyone born in 1981 or later 11.2%. The Fed defines that last line as Millennial and does not split Gen Z or Gen Alpha. It does not publish these shares by state.",
    url: "https://www.federalreserve.gov/releases/z1/dataviz/dfa/distribute/chart/",
  },
  {
    label: "Generation’s share of state population",
    detail:
      "Census Bureau, ACS 2020–2024 5-year table B01001, sex by age, for the nation, the 50 states, and D.C. Ages are as of 2024. A band that crosses a generation cut is split evenly by the years in it: Gen Alpha 0–11, Gen Z 12–27, Millennial 28–43, Gen X 44–59, boomer 60–78, Silent 79 and older. This is a population share, not a wealth share.",
    url: "https://data.census.gov/table/ACSDT5Y2024.B01001",
  },
] as const
