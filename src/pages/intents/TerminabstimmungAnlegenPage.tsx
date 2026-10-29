/**
 * Terminabstimmung anlegen — 4-Schritt-Wizard.
 * Steps: 1) Grunddaten → 2) Terminvorschlag mit Start und Ende → 3) Teilnehmer → 4) Prüfen & als Entwurf speichern.
 * Reads: — (nur über den Flow-Hook). Writes: terminabstimmungen, terminvorschlaege, teilnehmer
 * (createTerminabstimmungenEntry / createTerminvorschlaegeEntry / createTeilnehmerEntry über den Plan des Hooks).
 * Composes: IntentWizardShell, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { useTerminabstimmungAnlegenFlow } from '@/lib/journey/flows/TerminabstimmungAnlegen';
import { tx } from '@/i18n';

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export default function TerminabstimmungAnlegenPage() {
  const [step, setStep] = useState(1);
  const flow = useTerminabstimmungAnlegenFlow({
    steps: {
      titel: 1, beschreibung: 1, organisator_vorname: 1, organisator_nachname: 1, organisator_email: 1,
      standarddauer_minuten: 1, ort: 1, online_meeting_link: 1, zeitzone: 1, antwortfrist: 1, entscheidungsregel: 1,
      startzeit: 2, endzeit: 2, ort_abweichend: 2, meeting_link_abweichend: 2, reihenfolge: 2,
      vorname: 3, nachname: 3, email: 3, organisation: 3, rolle: 3,
    },
    initial: { reihenfolge: 1 },
    compute: { zugriffstoken: () => randomToken() },
  });

  const tv = flow.forms.terminvorschlaege;
  const checkTimes = () => {
    if (!flow.validateStep(2)) return false;
    const start = String(tv.get('startzeit') ?? '');
    const end = String(tv.get('endzeit') ?? '');
    if (start && end && end <= start) return tx('Das Ende muss nach dem Start liegen.');
    return true;
  };

  return (
    <IntentWizardShell
      title={tx('Terminabstimmung anlegen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Lege eine Terminabstimmung mit Terminvorschlag und Teilnehmer als Entwurf an.'),
        needs: [tx('Titel und Beschreibung'), tx('Deine Kontaktdaten'), tx('Start und Ende des Termins'), tx('Name und E-Mail der Teilnehmer')],
      }}
    >
      <WizardStep label={tx('Grunddaten')} description={tx('Worum geht es, wer organisiert und bis wann sollen die Teilnehmer antworten?')}>
        <div className="space-y-4">
          <Bound form={flow.forms.terminabstimmungen} name="titel" />
          <Bound form={flow.forms.terminabstimmungen} name="beschreibung" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Bound form={flow.forms.terminabstimmungen} name="organisator_vorname" />
            <Bound form={flow.forms.terminabstimmungen} name="organisator_nachname" />
          </div>
          <Bound form={flow.forms.terminabstimmungen} name="organisator_email" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Bound form={flow.forms.terminabstimmungen} name="standarddauer_minuten" />
            <Bound form={flow.forms.terminabstimmungen} name="antwortfrist" />
          </div>
          <Bound form={flow.forms.terminabstimmungen} name="ort" />
          <Bound form={flow.forms.terminabstimmungen} name="online_meeting_link" />
          <Bound form={flow.forms.terminabstimmungen} name="zeitzone" />
          <Bound form={flow.forms.terminabstimmungen} name="entscheidungsregel" />
          <StepNav hideBack onNext={() => flow.validateStep(1)} nextStepLabel={tx('Terminvorschlag')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Terminvorschlag')} description={tx('Wann könnte der Termin stattfinden? Start und Ende angeben.')}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Bound form={tv} name="startzeit" />
            <Bound form={tv} name="endzeit" />
          </div>
          <Bound form={tv} name="ort_abweichend" />
          <Bound form={tv} name="meeting_link_abweichend" />
          <Bound form={tv} name="reihenfolge" />
          <StepNav onBack={() => setStep(1)} onNext={checkTimes} nextStepLabel={tx('Teilnehmer')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Teilnehmer')} description={tx('Wen möchtest du einladen? Name, E-Mail und Rolle eintragen.')}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Bound form={flow.forms.teilnehmer} name="vorname" />
            <Bound form={flow.forms.teilnehmer} name="nachname" />
          </div>
          <Bound form={flow.forms.teilnehmer} name="email" />
          <Bound form={flow.forms.teilnehmer} name="organisation" />
          <Bound form={flow.forms.teilnehmer} name="rolle" />
          <StepNav onBack={() => setStep(2)} onNext={() => flow.validateStep(3)} nextStepLabel={tx('Prüfen')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'status', label: tx('Status'), value: tx('Entwurf') }]}
            confirmLabel={tx('Als Entwurf speichern')}
            whatHappensNext={tx('Die Abstimmung wird als Entwurf gespeichert. Eingeladen wird erst, wenn du sie versendest.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          whatHappensNext={tx('Als Nächstes kannst du die Abstimmung an die Teilnehmer versenden.')}
          next={[
            { label: tx('Abstimmung versenden'), href: '#/intents/abstimmung-versenden' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
