"use client"

import { useMemo, useRef, useState } from "react"
import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  TrendingDown,
  Users,
  Bus,
  Info,
} from "lucide-react"
import { submitQuote } from "@/app/actions/forms"
import { quoteRouteSchema, QUOTE_ROUTE_FIELDS, type FormState } from "@/lib/validation/forms"
import {
  estimate,
  formatAED,
  DAYS_PER_WEEK_OPTIONS,
  PRICING_BASE,
  type EstimatorResult,
  type TripType,
} from "@/lib/pricing"
import { Field, TextArea, Honeypot } from "@/components/site/form-fields"
import { cn } from "@/lib/utils"
import { LeadAttributionFields } from "@/components/site/lead-attribution-fields"

const initial: FormState = { ok: false }

const STEPS = ["Your route", "Your estimate", "Your details"] as const

type RouteValues = {
  service: string
  pickupLocation: string
  dropoffLocation: string
  passengers: string
  distanceKm: string
  daysPerWeek: string
  tripType: TripType | ""
}

type RouteField = keyof RouteValues

const inputClass =
  "w-full rounded-lg border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-accent focus:ring-2 focus:ring-accent/20"

function Stepper({ current }: { current: number }) {
  return (
    <ol className="mb-8 flex items-center gap-2" aria-label="Progress">
      {STEPS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "active" : "todo"
        return (
          <li
            key={label}
            className="flex flex-1 items-center gap-2"
            aria-current={state === "active" ? "step" : undefined}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                state === "done" && "bg-accent text-accent-foreground",
                state === "active" && "bg-primary text-primary-foreground",
                state === "todo" && "bg-muted text-muted-foreground",
              )}
            >
              {state === "done" ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : i + 1}
            </span>
            <span
              className={cn(
                "hidden text-xs font-medium sm:block",
                state === "active" ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="ml-1 h-px flex-1 bg-border" aria-hidden="true" />}
          </li>
        )
      })}
    </ol>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {pending ? "Sending..." : "Get my tailored proposal"}
    </button>
  )
}

function SuccessCard({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-10 text-center">
      <CheckCircle2 className="h-12 w-12 text-accent" aria-hidden="true" />
      <h3 className="font-display text-xl font-semibold text-foreground">Request received</h3>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{message}</p>
    </div>
  )
}

function FieldShell({
  id,
  label,
  error,
  children,
  className,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-sm font-medium text-foreground" htmlFor={id}>
        {label} <span className="text-accent">*</span>
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function EstimatePanel({ result, passengers }: { result: EstimatorResult; passengers: string }) {
  return (
    <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-primary to-[oklch(0.30_0.07_245)] p-6 text-primary-foreground sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Approximate pricing starts at</p>
      <p className="mt-3 font-display text-3xl font-bold sm:text-4xl">
        {formatAED(result.startingPrice)}
        <span className="ml-2 text-base font-medium text-primary-foreground/70">/ month</span>
      </p>
      <p className="mt-1 text-sm text-primary-foreground/70">
        {`≈ ${formatAED(result.perPassengerMonthly)} per passenger / month`}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-primary-foreground/10 p-4">
          <Bus className="h-5 w-5 text-accent" aria-hidden="true" />
          <ul className="mt-2 flex flex-col gap-0.5 text-sm font-semibold">
            {result.fleet.map((l) => (
              <li key={l.label}>{`${l.count}× ${l.label}`}</li>
            ))}
          </ul>
          <p className="text-xs text-primary-foreground/60">{`${result.totalSeats} seats in total`}</p>
        </div>
        <div className="rounded-xl bg-primary-foreground/10 p-4">
          <Users className="h-5 w-5 text-accent" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold">{`${passengers} passengers`}</p>
          <p className="text-xs text-primary-foreground/60">
            {`${result.legsPerDay === 2 ? "Round trip" : "One way"} · ${result.daysPerWeek} days/week · ${result.daysPerMonth} days/mo`}
          </p>
        </div>
        <div className="rounded-xl bg-accent/15 p-4">
          <TrendingDown className="h-5 w-5 text-accent" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold">
            {result.savingsPct > 0 ? `Save ~${result.savingsPct}%` : "Dedicated fleet"}
          </p>
          <p className="text-xs text-primary-foreground/60">
            {result.monthlySavings > 0
              ? `${formatAED(result.monthlySavings)}/mo vs ride-hailing`
              : "Fixed monthly cost, no surge pricing"}
          </p>
        </div>
      </div>
    </div>
  )
}

export function QuoteWizard({ services }: { services: string[] }) {
  const [state, action] = useActionState(submitQuote, initial)
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<RouteValues>({
    service: "",
    pickupLocation: "",
    dropoffLocation: "",
    passengers: "",
    distanceKm: "",
    daysPerWeek: String(DAYS_PER_WEEK_OPTIONS[0].days),
    tripType: "round-trip",
  })
  const [clientErrors, setClientErrors] = useState<Partial<Record<RouteField, string>>>({})
  const fieldRefs = useRef<Partial<Record<RouteField, HTMLElement | null>>>({})

  const today = new Date().toISOString().slice(0, 10)

  const parsedRoute = useMemo(() => quoteRouteSchema.safeParse(values), [values])
  const result = useMemo(
    () => (parsedRoute.success ? estimate(parsedRoute.data) : null),
    [parsedRoute],
  )

  const serverRouteErrors = QUOTE_ROUTE_FIELDS.filter((f) => state.errors?.[f])
  const errorFor = (f: RouteField) => clientErrors[f] ?? state.errors?.[f]

  function update<K extends RouteField>(key: K, value: RouteValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    if (clientErrors[key]) setClientErrors((e) => ({ ...e, [key]: undefined }))
  }

  function goToEstimate() {
    if (parsedRoute.success) {
      setClientErrors({})
      setStep(1)
      return
    }
    const next: Partial<Record<RouteField, string>> = {}
    for (const issue of parsedRoute.error.issues) {
      const key = issue.path[0] as RouteField
      if (key && !next[key]) next[key] = issue.message
    }
    setClientErrors(next)
    const first = QUOTE_ROUTE_FIELDS.find((f) => next[f])
    if (first) fieldRefs.current[first]?.focus()
  }

  if (state.ok) return <SuccessCard message={state.message} />

  const ariaFor = (f: RouteField) => ({
    "aria-invalid": errorFor(f) ? true : undefined,
    "aria-describedby": errorFor(f) ? `wiz-${f}-error` : undefined,
  })
  const borderFor = (f: RouteField) => (errorFor(f) ? "border-destructive" : "border-border")

  return (
    <form action={action} className="relative flex flex-col" noValidate={step === 0}>
      <Honeypot />
      <LeadAttributionFields />
      <Stepper current={step} />

      {state.message ? (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{state.message}</span>
        </div>
      ) : null}

      {serverRouteErrors.length > 0 && step !== 0 ? (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <span className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Some route details need attention.
          </span>
          <button type="button" onClick={() => setStep(0)} className="font-semibold underline">
            Review route
          </button>
        </div>
      ) : null}

      {/* Hidden inputs persist step 1 values into the single submission. */}
      <input type="hidden" name="service" value={values.service} />
      <input type="hidden" name="pickupLocation" value={values.pickupLocation} />
      <input type="hidden" name="dropoffLocation" value={values.dropoffLocation} />
      <input type="hidden" name="passengers" value={values.passengers} />
      <input type="hidden" name="distanceKm" value={values.distanceKm} />
      <input type="hidden" name="tripType" value={values.tripType} />
      <input type="hidden" name="daysPerWeek" value={values.daysPerWeek} />

      {/* ---------------------------- Step 1 --------------------------- */}
      <div className={cn("flex flex-col gap-5", step !== 0 && "hidden")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <FieldShell id="wiz-service" label="Service needed" error={errorFor("service")} className="sm:col-span-2">
            <select
              id="wiz-service"
              ref={(el) => {
                fieldRefs.current.service = el
              }}
              value={values.service}
              onChange={(e) => update("service", e.target.value)}
              className={cn(inputClass, "appearance-none", borderFor("service"), !values.service && "text-muted-foreground")}
              {...ariaFor("service")}
            >
              <option value="" disabled>
                Select a service
              </option>
              {services.map((s) => (
                <option key={s} value={s} className="text-foreground">
                  {s}
                </option>
              ))}
            </select>
          </FieldShell>

          <FieldShell id="wiz-pickupLocation" label="Pickup / city" error={errorFor("pickupLocation")}>
            <input
              id="wiz-pickupLocation"
              ref={(el) => {
                fieldRefs.current.pickupLocation = el
              }}
              value={values.pickupLocation}
              onChange={(e) => update("pickupLocation", e.target.value)}
              placeholder="e.g. Al Barsha, Dubai"
              maxLength={200}
              autoComplete="off"
              className={cn(inputClass, borderFor("pickupLocation"))}
              {...ariaFor("pickupLocation")}
            />
          </FieldShell>

          <FieldShell id="wiz-dropoffLocation" label="Drop-off / site" error={errorFor("dropoffLocation")}>
            <input
              id="wiz-dropoffLocation"
              ref={(el) => {
                fieldRefs.current.dropoffLocation = el
              }}
              value={values.dropoffLocation}
              onChange={(e) => update("dropoffLocation", e.target.value)}
              placeholder="e.g. JAFZA, Jebel Ali"
              maxLength={200}
              autoComplete="off"
              className={cn(inputClass, borderFor("dropoffLocation"))}
              {...ariaFor("dropoffLocation")}
            />
          </FieldShell>

          <FieldShell id="wiz-passengers" label="Approx. passengers" error={errorFor("passengers")}>
            <input
              id="wiz-passengers"
              ref={(el) => {
                fieldRefs.current.passengers = el
              }}
              type="number"
              inputMode="numeric"
              min={1}
              max={1000}
              step={1}
              value={values.passengers}
              onChange={(e) => update("passengers", e.target.value)}
              placeholder="e.g. 50"
              className={cn(inputClass, borderFor("passengers"))}
              {...ariaFor("passengers")}
            />
          </FieldShell>

          <FieldShell id="wiz-distanceKm" label="One-way distance (km)" error={errorFor("distanceKm")}>
            <input
              id="wiz-distanceKm"
              ref={(el) => {
                fieldRefs.current.distanceKm = el
              }}
              type="number"
              inputMode="decimal"
              min={1}
              max={300}
              value={values.distanceKm}
              onChange={(e) => update("distanceKm", e.target.value)}
              placeholder="e.g. 25"
              className={cn(inputClass, borderFor("distanceKm"))}
              {...ariaFor("distanceKm")}
            />
          </FieldShell>

          <FieldShell id="wiz-daysPerWeek" label="Frequency" error={errorFor("daysPerWeek")}>
            <select
              id="wiz-daysPerWeek"
              ref={(el) => {
                fieldRefs.current.daysPerWeek = el
              }}
              value={values.daysPerWeek}
              onChange={(e) => update("daysPerWeek", e.target.value)}
              className={cn(inputClass, "appearance-none", borderFor("daysPerWeek"))}
              {...ariaFor("daysPerWeek")}
            >
              {DAYS_PER_WEEK_OPTIONS.map((o) => (
                <option key={o.days} value={o.days}>
                  {o.label}
                </option>
              ))}
            </select>
          </FieldShell>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground" id="wiz-tripType-label">
              Trip type <span className="text-accent">*</span>
            </span>
            <div
              className="flex gap-2"
              role="radiogroup"
              aria-labelledby="wiz-tripType-label"
              ref={(el) => {
                fieldRefs.current.tripType = el
              }}
              tabIndex={-1}
            >
              {(["round-trip", "one-way"] as TripType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={values.tripType === t}
                  onClick={() => update("tripType", t)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                    values.tripType === t
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-accent/50",
                  )}
                >
                  {t === "round-trip" ? "Round Trip" : "One Way"}
                </button>
              ))}
            </div>
            {errorFor("tripType") ? (
              <p className="text-xs font-medium text-destructive">{errorFor("tripType")}</p>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={goToEstimate}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            See my estimate
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ---------------------------- Step 2 --------------------------- */}
      {step === 1 && result ? (
        <div className="flex flex-col gap-6">
          <EstimatePanel result={result} passengers={values.passengers} />

          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            <p>
              {`Pricing is approximate. Packages are based on 1 round trip per day within ${PRICING_BASE.includedDailyKm} km daily mileage for ${PRICING_BASE.daysPerMonth} operating days a month (5-day week). Additional mileage, a 6-day week and one-way service are adjusted pro rata. Your tailored proposal — with exact routing, vehicle mix and SLAs — is prepared by a ViaRidez mobility specialist.`}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent/50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Adjust
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/90"
            >
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      {/* ---------------------------- Step 3 --------------------------- */}
      <div className={cn("flex flex-col gap-5", step !== 2 && "hidden")}>
        {result ? (
          <p className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-foreground">
            {"Approximate pricing starts at "}
            <strong>{formatAED(result.startingPrice)}</strong>
            {` / month · ${result.fleetSummary}`}
          </p>
        ) : null}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" name="name" required minLength={2} maxLength={120} error={state.errors?.name} autoComplete="name" />
          <Field label="Company" name="company" required minLength={2} maxLength={160} error={state.errors?.company} autoComplete="organization" />
          <Field label="Work email" name="email" type="email" required maxLength={160} error={state.errors?.email} autoComplete="email" />
          <Field label="Phone" name="phone" type="tel" required error={state.errors?.phone} autoComplete="tel" />
          <Field label="Preferred start date" name="startDate" type="date" min={today} error={state.errors?.startDate} />
        </div>
        <TextArea label="Anything else we should know?" name="message" rows={3} maxLength={4000} error={state.errors?.message} />
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:border-accent/50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </button>
          <SubmitButton />
        </div>
      </div>
    </form>
  )
}
