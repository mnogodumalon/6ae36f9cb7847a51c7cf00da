/**
 * Termin festlegen — 5-Schritt-Wizard.
 * Steps: 1) Abstimmung auswählen → 2) Auswertung der Terminvorschläge ansehen → 3) Terminvorschlag wählen
 *        → 4) Teilnehmer mit Nein oder ohne Rückmeldung prüfen (+ Kommentar, Bestätigung) → 5) Festlegen (Prüfen).
 * Reads: terminabstimmungen, terminvorschlaege, teilnehmer, rueckmeldungen (über flow.port).
 * Writes: terminabstimmungen (finaler_terminvorschlag, status, festgelegt_am, …), terminvorschlaege (final_gewaehlt)
 *         — über useTerminFestlegenFlow.
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useEffect, useMemo, useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { IconCircleCheck, IconAlertTriangle, IconUserOff } from '@tabler/icons-react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import {
  fieldText, fieldDate, fieldNumber, fieldLookup, fieldRef, refFilter,
  type JourneyRecord,
} from '@/lib/journey';
import { useTerminFestlegenFlow } from '@/lib/journey/flows/TerminFestlegen';
import { dateFnsLocale, tx } from '@/i18n';

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'dd.MM.yyyy HH:mm', { locale: dateFnsLocale() }) : '—';
}

function rangeText(r: JourneyRecord): string {
  const start = fieldDate(r, 'startzeit');
  const end = fieldDate(r, 'endzeit');
  return `${fmt(start)} – ${end ? fmt(end) : '—'}`;
}

export default function TerminFestlegenPage() {
  const [step, setStep] = useState(1);

  const flow = useTerminFestlegenFlow({
    steps: { terminabstimmungen: 1, terminvorschlaege: 3, finaler_terminvorschlag: 3, entscheidungskommentar: 4, bestaetigung_sofort_senden: 4 },
    items: {
      terminabstimmungen: r => ({
        id: r.id,
        title: fieldText(r, 'titel') || tx('Ohne Titel'),
        subtitle: fieldText(r, 'abstimmungsnummer'),
        status: fieldLookup(r, 'status') ?? undefined,
      }),
      finaler_terminvorschlag: r => ({
        id: r.id,
        title: rangeText(r),
        subtitle: tx`${fieldNumber(r, 'anzahl_ja') ?? 0} Ja · ${fieldNumber(r, 'anzahl_wenn_noetig') ?? 0} Wenn nötig · ${fieldNumber(r, 'anzahl_nein') ?? 0} Nein`,
        status: fieldLookup(r, 'eignung') ?? undefined,
      }),
      terminvorschlaege: r => ({ id: r.id, title: rangeText(r) }),
    },
  });

  const abstimmungId = flow.targets.terminabstimmungen.selectedId;
  const finalId = (flow.forms.terminabstimmungen.get('finaler_terminvorschlag') as string | null) || null;

  // Vorschläge der gewählten Abstimmung
  const [vorschlaege, setVorschlaege] = useState<JourneyRecord[]>([]);
  const [vLoading, setVLoading] = useState(false);
  const [vError, setVError] = useState<string | null>(null);
  // Teilnehmer + Rückmeldungen zum gewählten Vorschlag
  const [teilnehmer, setTeilnehmer] = useState<JourneyRecord[]>([]);
  const [rueck, setRueck] = useState<JourneyRecord[]>([]);
  const [rLoading, setRLoading] = useState(false);

  useEffect(() => {
    if (!abstimmungId) { setVorschlaege([]); return; }
    let on = true;
    setVLoading(true);
    setVError(null);
    flow.port.list('terminvorschlaege', { filter: refFilter('terminabstimmung', abstimmungId), limit: 200 })
      .then(list => { if (on) setVorschlaege(list); })
      .catch(e => { if (on) setVError(e instanceof Error ? e.message : tx('Terminvorschläge konnten nicht geladen werden.')); })
      .finally(() => { if (on) setVLoading(false); });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- port is a stable door
  }, [abstimmungId]);

  useEffect(() => {
    if (!abstimmungId || !finalId) { setTeilnehmer([]); setRueck([]); return; }
    let on = true;
    setRLoading(true);
    Promise.all([
      flow.port.list('teilnehmer', { filter: refFilter('terminabstimmung', abstimmungId), limit: 500 }),
      flow.port.list('rueckmeldungen', { filter: refFilter('terminvorschlag', finalId), limit: 500 }),
    ])
      .then(([t, r]) => { if (on) { setTeilnehmer(t); setRueck(r); } })
      .catch(() => { if (on) { setTeilnehmer([]); setRueck([]); } })
      .finally(() => { if (on) setRLoading(false); });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- port is a stable door
  }, [abstimmungId, finalId]);

  const sorted = useMemo(
    () => [...vorschlaege].sort((a, b) => (fieldDate(a, 'startzeit') ?? '').localeCompare(fieldDate(b, 'startzeit') ?? '')),
    [vorschlaege],
  );
  const allowedIds = useMemo(() => new Set(vorschlaege.map(v => v.id)), [vorschlaege]);

  // Nein / ohne Rückmeldung zum gewählten Vorschlag
  const concerns = useMemo(() => {
    const answer = new Map<string, string>();
    rueck.forEach(r => {
      const t = fieldRef(r, 'teilnehmer');
      const v = fieldLookup(r, 'verfuegbarkeit')?.key;
      if (t && v) answer.set(t, v);
    });
    return teilnehmer
      .map(t => {
        const a = answer.get(t.id);
        return {
          id: t.id,
          name: `${fieldText(t, 'vorname')} ${fieldText(t, 'nachname')}`.trim() || tx('Unbekannt'),
          rolle: fieldLookup(t, 'rolle')?.label ?? '',
          kind: a === 'nein' ? 'nein' as const : a ? null : 'offen' as const,
        };
      })
      .filter(c => c.kind !== null);
  }, [teilnehmer, rueck]);

  const chooseVorschlag = (id: string) => {
    const rec = sorted.find(v => v.id === id) ?? flow.picks.finaler_terminvorschlag.recordOf(id);
    if (rec) flow.picks.terminvorschlaege.adopt(rec);
    flow.targets.terminvorschlaege.onSelect(id);
    flow.pick('finaler_terminvorschlag').onSelect(id);
  };

  const finalSelect = {
    ...flow.picks.finaler_terminvorschlag.select,
    items: flow.picks.finaler_terminvorschlag.select.items.filter(i => allowedIds.has(i.id)),
    onSearch: flow.picks.finaler_terminvorschlag.select.onSearch
      ? async (q: string, signal: AbortSignal) =>
        (await flow.picks.finaler_terminvorschlag.select.onSearch!(q, signal)).filter(i => allowedIds.has(i.id))
      : undefined,
  };

  const checkFinal = (): boolean | string => {
    if (!flow.validateStep(3)) return false;
    if (!finalId) return false;
    const other = vorschlaege.find(v => v.id !== finalId && v.fields.final_gewaehlt === true);
    if (other) return tx('Es darf nur einen finalen Terminvorschlag geben.');
    return true;
  };

  const missingAbstimmung = (
    <StepNav onBack={() => setStep(1)} nextDisabled>
      {tx('Dieser Schritt braucht die Auswahl der Abstimmung aus Schritt 1.')}
    </StepNav>
  );

  return (
    <IntentWizardShell
      title={tx('Termin festlegen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Wähle den besten Terminvorschlag und lege ihn verbindlich fest.'),
        needs: [tx('Die Abstimmung, die du festlegen willst')],
      }}
    >
      <WizardStep label={tx('Abstimmung')} description={tx('Für welche Terminabstimmung legst du den Termin fest?')}>
        <EntitySelectStep
          {...flow.picks.terminabstimmungen.select}
          {...flow.pick('terminabstimmungen')}
          searchPlaceholder={tx('Titel oder Nummer suchen …')}
          avatar="none"
        />
      </WizardStep>

      <WizardStep label={tx('Auswertung')} description={tx('So haben die Teilnehmer auf die Vorschläge geantwortet.')}>
        {!abstimmungId ? missingAbstimmung : (
          <div className="space-y-4">
            {flow.targets.terminabstimmungen.record && (
              <p className="text-sm text-muted-foreground">
                {tx`Abstimmung: ${fieldText(flow.targets.terminabstimmungen.record, 'titel')}`}
              </p>
            )}
            {vLoading && <p className="text-sm text-muted-foreground">{tx('Lade Auswertung …')}</p>}
            {vError && <p className="text-sm text-destructive">{vError}</p>}
            {!vLoading && !vError && sorted.length === 0 && (
              <p className="text-sm text-muted-foreground">{tx('Zu dieser Abstimmung gibt es noch keine Terminvorschläge.')}</p>
            )}
            <div className="grid gap-3">
              {sorted.map(v => {
                const ja = fieldNumber(v, 'anzahl_ja') ?? 0;
                const wenn = fieldNumber(v, 'anzahl_wenn_noetig') ?? 0;
                const nein = fieldNumber(v, 'anzahl_nein') ?? 0;
                const offen = fieldNumber(v, 'anzahl_ohne_antwort') ?? 0;
                const pflicht = fieldNumber(v, 'anzahl_pflichtteilnehmer_ja') ?? 0;
                const eignung = fieldLookup(v, 'eignung');
                return (
                  <div key={v.id} className="rounded-2xl border bg-card p-4 overflow-hidden">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium min-w-0 break-words">{rangeText(v)}</p>
                      {eignung && <span className="text-xs font-medium text-muted-foreground">{tx`Eignung: ${eignung.label}`}</span>}
                    </div>
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="rounded-xl bg-emerald-500/10 p-2"><p className="text-lg font-semibold text-emerald-700">{ja}</p><p className="text-xs text-muted-foreground">{tx('Ja')}</p></div>
                      <div className="rounded-xl bg-amber-500/10 p-2"><p className="text-lg font-semibold text-amber-700">{wenn}</p><p className="text-xs text-muted-foreground">{tx('Wenn nötig')}</p></div>
                      <div className="rounded-xl bg-red-500/10 p-2"><p className="text-lg font-semibold text-red-700">{nein}</p><p className="text-xs text-muted-foreground">{tx('Nein')}</p></div>
                      <div className="rounded-xl bg-secondary p-2"><p className="text-lg font-semibold">{offen}</p><p className="text-xs text-muted-foreground">{tx('Ohne Antwort')}</p></div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{tx`${pflicht} Pflichtteilnehmer haben zugesagt`}</p>
                  </div>
                );
              })}
            </div>
            <StepNav onBack={() => setStep(1)} nextStepLabel={tx('Vorschlag wählen')} nextDisabled={sorted.length === 0} />
          </div>
        )}
      </WizardStep>

      <WizardStep label={tx('Terminvorschlag')} description={tx('Welcher Termin soll verbindlich gelten?')}>
        {!abstimmungId ? missingAbstimmung : (
          <div className="space-y-4">
            <EntitySelectStep
              {...finalSelect}
              {...flow.pick('finaler_terminvorschlag')}
              onSelect={chooseVorschlag}
              avatar="none"
              searchPlaceholder={tx('Vorschlag suchen …')}
              emptyText={tx('Zu dieser Abstimmung gibt es keine Terminvorschläge.')}
            />
            <StepNav onBack={() => setStep(2)} onNext={checkFinal} nextStepLabel={tx('Teilnehmer prüfen')} />
          </div>
        )}
      </WizardStep>

      <WizardStep label={tx('Teilnehmer prüfen')} description={tx('Diese Personen haben Nein gesagt oder noch nicht geantwortet.')}>
        {!abstimmungId || !finalId ? (
          <StepNav onBack={() => setStep(3)} nextDisabled>
            {tx('Dieser Schritt braucht die Auswahl des Terminvorschlags aus Schritt 3.')}
          </StepNav>
        ) : (
          <div className="space-y-4">
            {rLoading && <p className="text-sm text-muted-foreground">{tx('Lade Rückmeldungen …')}</p>}
            {!rLoading && concerns.length === 0 && (
              <div className="flex items-center gap-2 rounded-2xl border bg-card p-4 text-sm">
                <IconCircleCheck size={18} className="shrink-0 text-emerald-600" />
                <span>{tx('Alle Teilnehmer haben für diesen Termin zugesagt.')}</span>
              </div>
            )}
            {concerns.length > 0 && (
              <ul className="divide-y rounded-2xl border bg-card overflow-hidden">
                {concerns.map(c => (
                  <li key={c.id} className="flex items-center gap-3 p-3">
                    {c.kind === 'nein'
                      ? <IconUserOff size={18} className="shrink-0 text-red-600" />
                      : <IconAlertTriangle size={18} className="shrink-0 text-amber-600" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.name}</p>
                      {c.rolle && <p className="truncate text-xs text-muted-foreground">{c.rolle}</p>}
                    </div>
                    <span className={c.kind === 'nein' ? 'text-sm font-medium text-red-700' : 'text-sm font-medium text-amber-700'}>
                      {c.kind === 'nein' ? tx('Nein') : tx('Keine Rückmeldung')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Bound form={flow.forms.terminabstimmungen} name="entscheidungskommentar" rows={3} hint={tx('Optional: Warum fiel die Wahl auf diesen Termin?')} />
            <Bound form={flow.forms.terminabstimmungen} name="bestaetigung_sofort_senden" />
            <StepNav onBack={() => setStep(3)} onNext={() => flow.validateStep(4)} nextStepLabel={tx('Festlegen')} />
          </div>
        )}
      </WizardStep>

      <WizardStep label={tx('Festlegen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            confirmLabel={tx('Termin verbindlich festlegen')}
            whatHappensNext={tx('Der Termin gilt danach als festgelegt und die Abstimmung wird abgeschlossen.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          title={tx('Termin festgelegt')}
          whatHappensNext={tx('Die Terminabstimmung ist jetzt abgeschlossen.')}
          next={[
            { label: tx('Terminabstimmung anlegen'), href: '#/intents/terminabstimmung-anlegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
