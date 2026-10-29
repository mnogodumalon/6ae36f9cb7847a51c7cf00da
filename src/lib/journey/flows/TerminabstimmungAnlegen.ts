/**
 * useTerminabstimmungAnlegenFlow — the plumbing of the flow « Terminabstimmung anlegen », generated from the plan.
 *
 * Writes `terminabstimmungen`: asks `titel`, `beschreibung`, `organisator_vorname`, `organisator_nachname`, `organisator_email`, `standarddauer_minuten`, `ort`, `online_meeting_link`, `zeitzone`, `antwortfrist`, `entscheidungsregel`; sets `status` itself; links `finaler_terminvorschlag` ← the created `terminvorschlaege`.
Writes `terminvorschlaege`: asks `startzeit`, `endzeit`, `ort_abweichend`, `meeting_link_abweichend`, `reihenfolge`; sets `final_gewaehlt` itself; links `terminabstimmung` ← the created `terminabstimmungen`.
Writes `teilnehmer`: asks `vorname`, `nachname`, `email`, `organisation`, `rolle`; sets `einladungsstatus`, `teilnahme_abgesagt` itself; links `terminabstimmung` ← the created `terminabstimmungen`.
 * The hook OWNS: the form(s) with exactly these fields and the plan's required
 * ingredients, one record search per picked field (columns and filter from
 * the plan), and the submit plan with its fixed and derived values. A page
 * that only calls `flow.submit.run()` cannot write a field the plan does not
 * know — there is no way to spell it.
 *
 * YOU decide what a person notices, through the options:
 *   steps     which wizard step asks which field (default: one step per pick,
 *             then one for the typed fields, then "Prüfen" = step 2)
 *   items     how a search hit is displayed per pick (title, subtitle, status …)
 *   initial   prefills for typed fields
 *   messages  the sentence for an empty required field, per field
 *   compute   REQUIRED — the plan says these values are computed in the flow
 *             but leaves the rule to you: `zugriffstoken` (derived:computed:Langer, zufälliger, nicht erratbarer Zeichenwert, der nicht aus Name, E-Mail oder laufender Nummer besteht) *
 *   const flow = useTerminabstimmungAnlegenFlow({
 *     steps: { titel: 1, beschreibung: 1, organisator_vorname: 1, organisator_nachname: 1, organisator_email: 1, standarddauer_minuten: 1, ort: 1, online_meeting_link: 1, zeitzone: 1, antwortfrist: 1, entscheidungsregel: 1, startzeit: 1, endzeit: 1, ort_abweichend: 1, meeting_link_abweichend: 1, reihenfolge: 1, vorname: 1, nachname: 1, email: 1, organisation: 1, rolle: 1 },
 *     compute: { zugriffstoken: forms => null },
 *   });
 *   <IntentWizardShell forms={flow.forms} draftKey={flow.draftKey} …>
 *     <Bound form={flow.forms.terminabstimmungen} name="titel" />
 *     <Bound form={flow.forms.terminabstimmungen} name="beschreibung" />
 *     <Bound form={flow.forms.terminabstimmungen} name="organisator_vorname" />
 *     <Bound form={flow.forms.terminabstimmungen} name="organisator_nachname" />
 *     <Bound form={flow.forms.terminabstimmungen} name="organisator_email" />
 *     <Bound form={flow.forms.terminabstimmungen} name="standarddauer_minuten" />
 *     <Bound form={flow.forms.terminabstimmungen} name="ort" />
 *     <Bound form={flow.forms.terminabstimmungen} name="online_meeting_link" />
 *     <Bound form={flow.forms.terminabstimmungen} name="zeitzone" />
 *     <Bound form={flow.forms.terminabstimmungen} name="antwortfrist" />
 *     <Bound form={flow.forms.terminabstimmungen} name="entscheidungsregel" />
 *     <Bound form={flow.forms.terminvorschlaege} name="startzeit" />
 *     <Bound form={flow.forms.terminvorschlaege} name="endzeit" />
 *     <Bound form={flow.forms.terminvorschlaege} name="ort_abweichend" />
 *     <Bound form={flow.forms.terminvorschlaege} name="meeting_link_abweichend" />
 *     <Bound form={flow.forms.terminvorschlaege} name="reihenfolge" />
 *     <Bound form={flow.forms.teilnehmer} name="vorname" />
 *     <Bound form={flow.forms.teilnehmer} name="nachname" />
 *     <Bound form={flow.forms.teilnehmer} name="email" />
 *     <Bound form={flow.forms.teilnehmer} name="organisation" />
 *     <Bound form={flow.forms.teilnehmer} name="rolle" />
 *     <StepNav onNext={() => flow.validateStep(n)} />
 *     {!flow.submit.done && <SummaryStep forms={flow.formList} submit={flow.submit} />}
 *     {flow.submit.result && <SuccessStep result={flow.submit.result} forms={flow.formList} submit={flow.submit} />}
 *   </IntentWizardShell>
 */
import {
  useStepForm, useJourneySubmit, useRecordSearch,
  fieldText, fieldLookup, fieldLookups, fieldNumber, fieldDate, fieldRef,
  todayIso, nowIso, isEmptyValue, policyFixedValue, withPickPolicy, usePolicyVersion,
  type StepForm, type JourneyRecord, type RefContext, type SelectItemLike, type FormValues, type PlanStep, type SummaryItem,} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { labelOf, optionsOf, type EntityKey } from '@/lib/journey/rules';
export type TerminabstimmungAnlegenFieldKey = 'antwortfrist' | 'beschreibung' | 'email' | 'endzeit' | 'entscheidungsregel' | 'meeting_link_abweichend' | 'nachname' | 'online_meeting_link' | 'organisation' | 'organisator_email' | 'organisator_nachname' | 'organisator_vorname' | 'ort' | 'ort_abweichend' | 'reihenfolge' | 'rolle' | 'standarddauer_minuten' | 'startzeit' | 'titel' | 'vorname' | 'zeitzone';

export interface TerminabstimmungAnlegenForms {
  terminabstimmungen: StepForm<'terminabstimmungen'>;
  terminvorschlaege: StepForm<'terminvorschlaege'>;
  teilnehmer: StepForm<'teilnehmer'>;
}

// Alias so the option generics stay readable.
type Key = TerminabstimmungAnlegenFieldKey;

export interface TerminabstimmungAnlegenFlowOptions {
  /** field → wizard step that asks it; drives „Ändern“ links and answer chips. */
  steps?: Partial<Record<Key, number>>;
  initial?: Partial<Record<Key, unknown>>;
  messages?: Partial<Record<Key, string>>;
  /** The plan computes these in the flow but leaves the rule to the page. */
  compute: {
    zugriffstoken: (forms: TerminabstimmungAnlegenForms) => unknown;   // derived:computed:Langer, zufälliger, nicht erratbarer Zeichenwert, der nicht aus Name, E-Mail oder laufender Nummer besteht
  };
}

const DEFAULT_STEPS: Record<string, number> = {"antwortfrist": 1, "beschreibung": 1, "email": 1, "endzeit": 1, "entscheidungsregel": 1, "meeting_link_abweichend": 1, "nachname": 1, "online_meeting_link": 1, "organisation": 1, "organisator_email": 1, "organisator_nachname": 1, "organisator_vorname": 1, "ort": 1, "ort_abweichend": 1, "reihenfolge": 1, "rolle": 1, "standarddauer_minuten": 1, "startzeit": 1, "titel": 1, "vorname": 1, "zeitzone": 1};
export const TERMINABSTIMMUNGANLEGEN_REVIEW_STEP = 2;

function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Returns T, not Partial<T>: a Record's index signature is already "maybe
// absent", and Partial<Record<string, string>> does not assign to the
// Record<string, string> useStepForm wants (tsc, live 23.09.2026 — eight
// errors, one per hook, caught only in the sandbox build).
function only<T extends Record<string, unknown>>(obj: T | undefined, keys: string[]): T | undefined {
  if (!obj) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out as T;
}

function hasValues(form: StepForm): boolean {
  return form.keys.some(k => !isEmptyValue(form.values[k]));
}

export function useTerminabstimmungAnlegenFlow(options: TerminabstimmungAnlegenFlowOptions) {
  const steps = { ...DEFAULT_STEPS, ...(options.steps ?? {}) } as Record<string, number>;
  const terminabstimmungen = useStepForm('terminabstimmungen', {
    fields: ["titel", "beschreibung", "organisator_vorname", "organisator_nachname", "organisator_email", "standarddauer_minuten", "ort", "online_meeting_link", "zeitzone", "antwortfrist", "entscheidungsregel"],
    steps: only(steps, ["titel", "beschreibung", "organisator_vorname", "organisator_nachname", "organisator_email", "standarddauer_minuten", "ort", "online_meeting_link", "zeitzone", "antwortfrist", "entscheidungsregel"]) as Record<string, number>,
    // the plan builds a value from these — required here, whatever the app's base view says
    required: { beschreibung: true, online_meeting_link: true, organisator_email: true, ort: true, titel: true, zeitzone: true },
    initial: only(options.initial as FormValues | undefined, ["titel", "beschreibung", "organisator_vorname", "organisator_nachname", "organisator_email", "standarddauer_minuten", "ort", "online_meeting_link", "zeitzone", "antwortfrist", "entscheidungsregel"]),
    messages: only(options.messages as Record<string, string> | undefined, ["titel", "beschreibung", "organisator_vorname", "organisator_nachname", "organisator_email", "standarddauer_minuten", "ort", "online_meeting_link", "zeitzone", "antwortfrist", "entscheidungsregel"]),
  });
  const terminvorschlaege = useStepForm('terminvorschlaege', {
    fields: ["startzeit", "endzeit", "ort_abweichend", "meeting_link_abweichend", "reihenfolge"],
    steps: only(steps, ["startzeit", "endzeit", "ort_abweichend", "meeting_link_abweichend", "reihenfolge"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["startzeit", "endzeit", "ort_abweichend", "meeting_link_abweichend", "reihenfolge"]),
    messages: only(options.messages as Record<string, string> | undefined, ["startzeit", "endzeit", "ort_abweichend", "meeting_link_abweichend", "reihenfolge"]),
  });
  const teilnehmer = useStepForm('teilnehmer', {
    fields: ["vorname", "nachname", "email", "organisation", "rolle"],
    steps: only(steps, ["vorname", "nachname", "email", "organisation", "rolle"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["vorname", "nachname", "email", "organisation", "rolle"]),
    messages: only(options.messages as Record<string, string> | undefined, ["vorname", "nachname", "email", "organisation", "rolle"]),
  });
  const forms: TerminabstimmungAnlegenForms = { terminabstimmungen, terminvorschlaege, teilnehmer };
  const formList: StepForm[] = [terminabstimmungen, terminvorschlaege, teilnehmer];

  // The owner's rules after the build (intent-policies.json): a fixed value
  // for a field this flow sets itself, a narrower or wider pick — read at
  // render time, so a change works on the running application.
  usePolicyVersion();
  const searches = {
  };
  // Whether a pick offers „Neu anlegen“ is the plan's call: off for the record
  // this flow changes, for multi picks, for a catalogue entity and for an
  // entity with its own flow. The page spreads `.select` and writes no `create=`.
  // a fixed value the flow sets itself, as a review row with the link that changes it
  const setting = (entity: EntityKey, field: string, value: unknown): SummaryItem => ({
    key: `setting:${entity}.${field}`, label: labelOf(entity, field),
    value: optionsOf(entity, field).find(o => o.key === String(value))?.label ?? String(value ?? ''),
    href: `#/verwaltung/anwendung?line=intent:terminabstimmung-anlegen:write:${entity}.${field}`,
  });
  const picks = {
  };

  const plan: PlanStep[] = [
    {
      key: 'terminabstimmungen', entity: 'terminabstimmungen', form: terminabstimmungen,      needs: ['terminvorschlaege'],
      link: { finaler_terminvorschlag: 'terminvorschlaege' },

      values: (): FormValues => ({
        status: policyFixedValue('terminabstimmungen', 'status') ?? "entwurf",
      }),

      // the review shows what this step sets itself — changeable on „Deine Anwendung“, not here
      settings: () => [setting('terminabstimmungen', 'status', policyFixedValue('terminabstimmungen', 'status') ?? "entwurf")],
    },
    {
      key: 'terminvorschlaege', entity: 'terminvorschlaege', form: terminvorschlaege,      needs: ['terminabstimmungen'],
      link: { terminabstimmung: 'terminabstimmungen' },

      values: (): FormValues => ({
        final_gewaehlt: policyFixedValue('terminvorschlaege', 'final_gewaehlt') ?? false,
      }),

      // the review shows what this step sets itself — changeable on „Deine Anwendung“, not here
      settings: () => [setting('terminvorschlaege', 'final_gewaehlt', policyFixedValue('terminvorschlaege', 'final_gewaehlt') ?? false)],
    },
    {
      key: 'teilnehmer', entity: 'teilnehmer', form: teilnehmer, primary: true,      needs: ['terminabstimmungen'],
      link: { terminabstimmung: 'terminabstimmungen' },

      values: (): FormValues => ({
        einladungsstatus: policyFixedValue('teilnehmer', 'einladungsstatus') ?? "nicht_versendet",
        teilnahme_abgesagt: policyFixedValue('teilnehmer', 'teilnahme_abgesagt') ?? false,
        zugriffstoken: options.compute.zugriffstoken(forms),
      }),

      // the review shows what this step sets itself — changeable on „Deine Anwendung“, not here
      settings: () => [setting('teilnehmer', 'einladungsstatus', policyFixedValue('teilnehmer', 'einladungsstatus') ?? "nicht_versendet"), setting('teilnehmer', 'teilnahme_abgesagt', policyFixedValue('teilnehmer', 'teilnahme_abgesagt') ?? false)],

      // the planner's assumptions that first act here — shown once with „Passt“ / „ändern“
      notices: () => [{"assumed": "TA-2026-0001", "id": "abstimmungsnummer-format", "question": "Welches Format soll die Abstimmungsnummer haben?"}],
    },
  ];

  const submit = useJourneySubmit(servicePort, plan, { draftKey: 'terminabstimmung-anlegen' });

  /** Props for a single-record pick step: {...flow.picks.x.select} {...flow.pick('x')} */
  const pick = (field: TerminabstimmungAnlegenFieldKey) => {
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return {
      selectedId: (typeof owner.get(field) === 'string' ? (owner.get(field) as string) : null) || null,
      // `field as never` collapsed the conditional SetArgs<E, never> to never and
      // no argument was assignable any more (tsc, live 23.09.2026); widen `set`
      // itself instead — the label stays a required third argument.
      onSelect: (id: string) => (owner.set as (k: string, v: unknown, l?: string) => void)(field, id, search?.labelOf(id)),
    };
  };
  /** Props for a multi-record pick step: {...flow.picks.x.select} {...flow.pickMany('x')} */
  const pickMany = (field: TerminabstimmungAnlegenFieldKey) => {
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return owner.records(field, id => search?.labelOf(id));
  };
  /** Validate every field the wizard asks in step `n` — for StepNav.onNext. */
  const validateStep = (n: number): boolean =>
    formList.every(f => f.validate(f.keys.filter(k => steps[k] === n)));
  const reset = () => { submit.reset(); formList.forEach(f => f.reset()); };

  return {
    slug: 'terminabstimmung-anlegen' as const,
    draftKey: 'terminabstimmung-anlegen' as const,
    entity: 'teilnehmer' as const,
    form: teilnehmer,
    forms, formList, picks, submit, steps,    reviewStep: TERMINABSTIMMUNGANLEGEN_REVIEW_STEP,
    pick, pickMany, validateStep, reset,
    // the door the hook reads through — for what it does not own: availability
    // (useOccupancy(flow.port, …)), a count (useRecordCount(flow.port, …)). A page
    // importing servicePort next to the hook fails gate 3 (fewo 05.10.2026: the
    // gate taught useOccupancy(servicePort, …) and forbade servicePort at once)
    port: servicePort,
  };
}

export type TerminabstimmungAnlegenFlow = ReturnType<typeof useTerminabstimmungAnlegenFlow>;
