/**
 * Abstimmung versenden — 3-Schritt-Wizard.
 * Steps: 1) Entwurf wählen → 2) Terminvorschläge & Teilnehmer prüfen (Teilnehmer wählen) → 3) Prüfen & versenden
 *        (Status „Versendet" und Einladungsstatus der Teilnehmer setzt der Ablauf selbst).
 * Reads: terminabstimmungen (Entwürfe), terminvorschlaege (Anzahl), teilnehmer. Writes: terminabstimmungen, teilnehmer (Updates).
 * Composes: IntentWizardShell, EntitySelectStep, StepNav, SummaryStep, SuccessStep, StatusBadge.
 */
import { useState } from 'react';
import { IconCircleCheck, IconAlertTriangle } from '@tabler/icons-react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldDate, fieldRef, fieldLookup, refFilter, useRecordCount, nowIso, formatFieldValue } from '@/lib/journey';
import { useAbstimmungVersendenFlow } from '@/lib/journey/flows/AbstimmungVersenden';
import { tx } from '@/i18n';

export default function AbstimmungVersendenPage() {
  const [step, setStep] = useState(1);
  const flow = useAbstimmungVersendenFlow({
    steps: { terminabstimmungen: 1, teilnehmer: 2 },
    items: {
      terminabstimmungen: r => ({
        id: r.id,
        title: fieldText(r, 'titel'),
        subtitle: fieldDate(r, 'antwortfrist') ? tx`Antwortfrist: ${formatFieldValue('terminabstimmungen', 'antwortfrist', fieldDate(r, 'antwortfrist'))}` : undefined,
        status: fieldLookup(r, 'status') ?? undefined,
      }),
      teilnehmer: (r, ctx) => ({
        id: r.id,
        title: `${fieldText(r, 'vorname')} ${fieldText(r, 'nachname')}`.trim(),
        subtitle: [fieldText(r, 'email'), ctx.ref('terminabstimmung')].filter(Boolean).join(' · '),
        status: fieldLookup(r, 'rolle') ?? undefined,
      }),
    },
  });

  const pollId = flow.targets.terminabstimmungen.selectedId;
  const poll = flow.targets.terminabstimmungen.record;

  const vorschlaege = useRecordCount(flow.port, 'terminvorschlaege', {
    filter: pollId ? refFilter('terminabstimmung', pollId) : undefined,
    where: r => fieldRef(r, 'terminabstimmung') === pollId,
    enabled: Boolean(pollId),
  });
  const teilnehmerAnzahl = useRecordCount(flow.port, 'teilnehmer', {
    filter: pollId ? refFilter('terminabstimmung', pollId) : undefined,
    where: r => fieldRef(r, 'terminabstimmung') === pollId,
    enabled: Boolean(pollId),
  });

  const antwortfrist = poll ? fieldDate(poll, 'antwortfrist') : null;
  const fristAbgelaufen = Boolean(antwortfrist) && String(antwortfrist).slice(0, 16) < nowIso();
  const hasVorschlag = (vorschlaege.count ?? 0) > 0;
  const hasTeilnehmer = (teilnehmerAnzahl.count ?? 0) > 0;

  const checkStep2 = (): boolean | string => {
    if (!flow.validateStep(2)) return tx('Bitte wähle einen Teilnehmer, dessen Einladung versendet wird.');
    if (!hasVorschlag) return tx('Die Abstimmung braucht mindestens einen Terminvorschlag.');
    if (!hasTeilnehmer) return tx('Die Abstimmung braucht mindestens einen Teilnehmer.');
    if (fristAbgelaufen) return tx('Die Antwortfrist darf nicht vor dem Versand liegen.');
    return true;
  };

  const countRow = (ok: boolean, label: string, count: number | null) => (
    <li className="flex items-center gap-2 text-sm">
      {ok ? <IconCircleCheck size={18} className="shrink-0 text-emerald-600" /> : <IconAlertTriangle size={18} className="shrink-0 text-amber-600" />}
      <span className="min-w-0">{label}: <b>{count ?? '…'}</b></span>
    </li>
  );

  return (
    <IntentWizardShell
      title={tx('Abstimmung versenden')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{ description: tx('Eine Abstimmung aus dem Entwurf heraus an die Teilnehmer versenden.'), needs: [tx('Einen Entwurf mit Terminvorschlägen'), tx('Mindestens einen Teilnehmer')] }}
    >
      <WizardStep label={tx('Entwurf')} description={tx('Welche Abstimmung soll versendet werden?')}>
        <EntitySelectStep
          {...flow.picks.terminabstimmungen.select}
          {...flow.pick('terminabstimmungen')}
          avatar="none"
          searchPlaceholder={tx('Titel suchen …')}
          emptyText={tx('Es gibt keinen Entwurf, der versendet werden kann.')}
        />
      </WizardStep>

      <WizardStep label={tx('Prüfen')} description={tx('Terminvorschläge und Teilnehmer kontrollieren und den Teilnehmer wählen, der eingeladen wird.')}>
        {!pollId ? (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
          </StepNav>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border bg-secondary/40 p-4 space-y-2 overflow-hidden">
              <p className="font-medium truncate">{poll ? fieldText(poll, 'titel') : flow.picks.terminabstimmungen.labelOf(pollId)}</p>
              <ul className="space-y-1">
                {countRow(hasVorschlag, tx('Terminvorschläge'), vorschlaege.count)}
                {countRow(hasTeilnehmer, tx('Teilnehmer'), teilnehmerAnzahl.count)}
                {antwortfrist && countRow(!fristAbgelaufen, tx('Antwortfrist'), null)}
              </ul>
              {antwortfrist && (
                <p className={`text-sm ${fristAbgelaufen ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {fristAbgelaufen
                    ? tx`Die Antwortfrist (${formatFieldValue('terminabstimmungen', 'antwortfrist', antwortfrist)}) liegt vor dem Versand.`
                    : tx`Antwortfrist: ${formatFieldValue('terminabstimmungen', 'antwortfrist', antwortfrist)}`}
                </p>
              )}
            </div>
            <EntitySelectStep
              {...flow.picks.teilnehmer.select}
              onSelect={flow.pick('teilnehmer').onSelect}
              selectedId={flow.pick('teilnehmer').selectedId}
              avatar="initials"
              searchPlaceholder={tx('Name oder E-Mail …')}
              emptyText={tx('Es gibt noch keine Teilnehmer.')}
            />
            <StepNav onBack={() => setStep(1)} onNext={checkStep2} nextStepLabel={tx('Versenden')} />
          </div>
        )}
      </WizardStep>

      <WizardStep label={tx('Versenden')} description={tx('Alles richtig? Dann geht die Abstimmung raus.')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            confirmLabel={tx('Abstimmung versenden')}
            whatHappensNext={tx('Der Status der Abstimmung wechselt auf „Versendet“, der Einladungsstatus des Teilnehmers wird gesetzt und der Versandzeitpunkt vermerkt.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          title={tx('Abstimmung versendet')}
          facts={[
            { label: tx('Status'), value: formatFieldValue('terminabstimmungen', 'status', 'versendet') },
            ...(antwortfrist ? [{ label: tx('Antwortfrist'), value: formatFieldValue('terminabstimmungen', 'antwortfrist', antwortfrist) }] : []),
          ]}
          next={[
            { label: tx('Termin festlegen'), href: '#/intents/termin-festlegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Sobald die Rückmeldungen da sind, kannst du den Termin festlegen.')}
        />
      )}
    </IntentWizardShell>
  );
}
