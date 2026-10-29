/**
 * Abstimmung absagen — 3-Schritt-Wizard.
 * Steps: 1) Abstimmung auswählen → 2) Absagegrund erfassen → 3) Absagen bestätigen.
 * Reads: terminabstimmungen (titel, status, antwortfrist). Writes: terminabstimmungen (update: status, abgesagt_am, entscheidungskommentar).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldLookup, fieldDate } from '@/lib/journey';
import { useAbstimmungAbsagenFlow } from '@/lib/journey/flows/AbstimmungAbsagen';
import { tx } from '@/i18n';

export default function AbstimmungAbsagenPage() {
  const [step, setStep] = useState(1);
  const flow = useAbstimmungAbsagenFlow({
    steps: { terminabstimmungen: 1, entscheidungskommentar: 2 },
    items: {
      terminabstimmungen: r => {
        const status = fieldLookup(r, 'status')?.label;
        const frist = fieldDate(r, 'antwortfrist');
        return {
          id: r.id,
          title: fieldText(r, 'titel'),
          subtitle: [status, frist ? tx`Antwortfrist ${frist.slice(0, 10)}` : null].filter(Boolean).join(' · '),
        };
      },
    },
  });

  return (
    <IntentWizardShell
      title={tx('Abstimmung absagen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Sage eine Terminabstimmung ab und halte den Grund fest.'),
        needs: [tx('Die Abstimmung, die abgesagt wird'), tx('Ein Grund für die Absage (optional)')],
      }}
    >
      <WizardStep label={tx('Abstimmung')} description={tx('Welche Abstimmung soll abgesagt werden?')}>
        <EntitySelectStep
          {...flow.picks.terminabstimmungen.select}
          {...flow.pick('terminabstimmungen')}
          searchPlaceholder={tx('Titel der Abstimmung …')}
        />
      </WizardStep>

      <WizardStep label={tx('Absagegrund')} description={tx('Warum wird die Abstimmung abgesagt?')} needs={['terminabstimmungen']}>
        <div className="space-y-4">
          <Bound
            form={flow.forms.terminabstimmungen}
            name="entscheidungskommentar"
            rows={4}
            hint={tx('Der Grund steht später im Verlauf der Abstimmung.')}
          />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => flow.validateStep(2)}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Bestätigen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'status', label: tx('Neuer Status'), value: tx('Abgesagt') }]}
            whatHappensNext={tx('Die Abstimmung wird als abgesagt markiert, der Zeitpunkt der Absage wird automatisch festgehalten.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          actions={{ copy: false, print: false }}
          next={[
            { label: tx('Neue Terminabstimmung anlegen'), href: '#/intents/terminabstimmung-anlegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Die Abstimmung ist abgesagt und kann nicht mehr festgelegt werden.')}
        />
      )}
    </IntentWizardShell>
  );
}
