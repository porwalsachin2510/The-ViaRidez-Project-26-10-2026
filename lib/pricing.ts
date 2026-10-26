/**
 * ViaRidez approximate pricing engine.
 *
 * Business rules (AED, per vehicle, per month):
 *   - 12 seater  → 8,500
 *   - 22 seater  → 12,500
 *   - 34 seater  → 14,500
 *   - 55–70 seater → 16,500
 * Each package covers 1 round trip per day, within 50 km daily mileage,
 * for 22 operating days a month (a 5-day week). A 6-day week is 26 days.
 *
 * Figures are approximate "starts at" prices — the real proposal is always
 * prepared by a mobility specialist. Pure module so the same maths runs in the
 * client preview and in the server action (the server never trusts the client).
 */

export type TripType = "one-way" | "round-trip"

export const DAYS_PER_WEEK_OPTIONS = [
  { days: 5, label: "5 days / week (weekdays)" },
  { days: 6, label: "6 days / week" },
] as const

export type DaysPerWeek = (typeof DAYS_PER_WEEK_OPTIONS)[number]["days"]

export const PRICING_BASE = {
  /** Operating days included in every monthly package. */
  daysPerMonth: 22,
  /** Daily mileage (km) included in every monthly package. */
  includedDailyKm: 50,
  /** One-way service (single leg) as a share of the round-trip package. */
  oneWayFactor: 0.6,
} as const

/** Vehicle tiers ordered by capacity. */
export const VEHICLE_TIERS = [
  { label: "12-seater van", seats: 12, monthlyRate: 8500 },
  { label: "22-seater mini bus", seats: 22, monthlyRate: 12500 },
  { label: "34-seater midi bus", seats: 34, monthlyRate: 14500 },
  { label: "55–70 seater coach", seats: 70, monthlyRate: 16500 },
] as const

export const MIN_STARTING_PRICE = VEHICLE_TIERS[0].monthlyRate

export interface EstimatorInput {
  passengers: number
  /** One-way distance between pickup and drop-off, in km. */
  distanceKm: number
  daysPerWeek: number
  tripType: TripType
}

export interface FleetLine {
  label: string
  seats: number
  count: number
  monthlyRate: number
}

export interface EstimatorResult {
  fleet: FleetLine[]
  /** Human summary, e.g. "1× 55–70 seater coach + 1× 12-seater van". */
  fleetSummary: string
  totalSeats: number
  legsPerDay: number
  daysPerWeek: number
  daysPerMonth: number
  dailyMileageKm: number
  /** Approximate monthly price this programme starts at (AED). */
  startingPrice: number
  rideHailingMonthly: number
  monthlySavings: number
  savingsPct: number
  perPassengerMonthly: number
}

const RIDE_HAILING_PER_KM = 2.4
const RIDE_HAILING_BASE_FARE = 12

function daysPerMonthFor(daysPerWeek: number) {
  return daysPerWeek >= 6 ? 26 : PRICING_BASE.daysPerMonth
}

function roundUpTo(n: number, step: number) {
  return Math.ceil(n / step) * step
}

/** Smallest tier that seats the group, or the coach when nothing smaller fits. */
function tierFor(passengers: number) {
  return VEHICLE_TIERS.find((t) => t.seats >= passengers) ?? VEHICLE_TIERS[VEHICLE_TIERS.length - 1]
}

/** Fill full coaches first, then cover any remainder with the smallest fitting tier. */
export function planFleet(passengers: number): FleetLine[] {
  const largest = VEHICLE_TIERS[VEHICLE_TIERS.length - 1]
  const lines = new Map<string, FleetLine>()
  const add = (tier: (typeof VEHICLE_TIERS)[number], count: number) => {
    if (count <= 0) return
    const existing = lines.get(tier.label)
    if (existing) existing.count += count
    else lines.set(tier.label, { label: tier.label, seats: tier.seats, monthlyRate: tier.monthlyRate, count })
  }

  const fullCoaches = Math.floor(passengers / largest.seats)
  const remainder = passengers - fullCoaches * largest.seats
  add(largest, fullCoaches)
  if (remainder > 0) add(tierFor(remainder), 1)

  return [...lines.values()].sort((a, b) => b.seats - a.seats)
}

export function estimate(input: EstimatorInput): EstimatorResult {
  const passengers = Math.max(1, Math.round(input.passengers) || 1)
  const distanceKm = Math.max(1, input.distanceKm || 1)
  const daysPerWeek = input.daysPerWeek >= 6 ? 6 : 5
  const legsPerDay = input.tripType === "one-way" ? 1 : 2

  const fleet = planFleet(passengers)
  const daysPerMonth = daysPerMonthFor(daysPerWeek)
  const dailyMileageKm = Math.round(distanceKm * legsPerDay)

  const fleetBase = fleet.reduce((sum, l) => sum + l.count * l.monthlyRate, 0)
  const dayFactor = daysPerMonth / PRICING_BASE.daysPerMonth
  const mileageFactor = Math.max(1, dailyMileageKm / PRICING_BASE.includedDailyKm)
  const tripFactor = legsPerDay === 1 ? PRICING_BASE.oneWayFactor : 1

  const raw = fleetBase * dayFactor * mileageFactor * tripFactor
  // Keep the published package prices exact; round adjusted prices up to 100.
  const startingPrice = raw === fleetBase ? fleetBase : roundUpTo(raw, 100)

  const perTrip = RIDE_HAILING_BASE_FARE + distanceKm * RIDE_HAILING_PER_KM
  const rideHailingMonthly = roundUpTo(passengers * perTrip * legsPerDay * daysPerMonth, 50)
  const monthlySavings = Math.max(0, rideHailingMonthly - startingPrice)
  const savingsPct = rideHailingMonthly > 0 ? Math.round((monthlySavings / rideHailingMonthly) * 100) : 0

  return {
    fleet,
    fleetSummary: fleet.map((l) => `${l.count}× ${l.label}`).join(" + "),
    totalSeats: fleet.reduce((sum, l) => sum + l.count * l.seats, 0),
    legsPerDay,
    daysPerWeek,
    daysPerMonth,
    dailyMileageKm,
    startingPrice,
    rideHailingMonthly,
    monthlySavings,
    savingsPct,
    perPassengerMonthly: Math.round(startingPrice / passengers),
  }
}

/** Format an AED amount for display, e.g. 12500 → "AED 12,500". */
export function formatAED(n: number): string {
  return `AED ${Math.round(n).toLocaleString("en-AE")}`
}

export function startingPriceLabel(n: number): string {
  return `Approximate pricing starts at ${formatAED(n)} / month`
}
