import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { PublicShell } from '@/components/PublicShell';
import { Textarea } from '@/components/ui/textarea';
import {
  loadPublicPagesConfig, PageUnavailableError,
  type PublicPagesConfig, type PublicPageConfig,
} from '@/lib/publicClient';
import {
  useStepForm, useJourneySubmit, useRecordSearch, nowIso, fieldText, fieldNumber, fieldDate, optionsOf,
  type PlanStep, type SummaryItem,
} from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { Bound } from '@/components/blocks/Bound';
import { tx } from '@/i18n';

interface Answer { verfuegbarkeit: string | null; kommentar: string }

function fmt(iso: string | null): string {
  if (!iso) return '';
  try { return format(parseISO(iso), 'dd.MM.yyyy HH:mm'); } catch { return iso; }
}

export default function AbstimmungTeilnehmen() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    loadPublicPagesConfig('abstimmung-teilnehmen')
      .then(c => { setCfg(c); setPage(c?.pages['abstimmung-teilnehmen'] ?? null); setLoading(false); })
      .catch(e => { if (e instanceof PageUnavailableError) setUnavailable(true); setLoading(false); });
  }, []);

  if (loading || unavailable || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading} />;
  }
  return <Inner cfg={cfg} page={page} />;
}

function Inner({ cfg, page }: { cfg: PublicPagesConfig; page: PublicPageConfig }) {
  const [params] = useSearchParams();
  const abstimmungId = params.get('abstimmung');
  const teilnehmerId = params.get('teilnehmer');

  const port = useMemo(() => createPublicPort(cfg, page), [cfg, page]);
  const vorschlaege = useRecordSearch(port, 'terminvorschlaege', {
    searchFields: ['ort_abweichend'],
    toItem: r => ({ id: r.id, title: fmt(fieldDate(r, 'startzeit')) }),
    loadAllUpTo: 500,
  });

  const alt = useStepForm('alternative_terminvorschlaege', {
    fields: ['terminabstimmung', 'vorgeschlagen_von', 'startzeit', 'endzeit', 'kommentar'],
    required: { terminabstimmung: false, vorgeschlagen_von: false, startzeit: false, endzeit: false },
    steps: { startzeit: 2, endzeit: 2, kommentar: 2 },
    autoComplete: true,
  });

  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  useEffect(() => {
    if (abstimmungId) alt.set('terminabstimmung', abstimmungId, '');
    if (teilnehmerId) alt.set('vorgeschlagen_von', teilnehmerId, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abstimmungId, teilnehmerId]);

  const sorted = useMemo(
    () => [...vorschlaege.records].sort((a, b) => (fieldNumber(a, 'reihenfolge') ?? 0) - (fieldNumber(b, 'reihenfolge') ?? 0)),
    [vorschlaege.records],
  );
  const options = optionsOf('rueckmeldungen', 'verfuegbarkeit');
  const label = (key: string | null) => options.find(o => o.key === key)?.label ?? '';

  const answered = sorted.filter(r => answers[r.id]?.verfuegbarkeit);
  const hasAlt = !!(alt.get('startzeit') || alt.get('endzeit'));

  const plan: PlanStep[] = [
    ...answered.map((r, i) => ({
      key: `rueckmeldung_${r.id}`,
      entity: 'rueckmeldungen' as const,
      label: tx('Rückmeldung'),
      primary: i === 0,
      values: () => ({
        terminabstimmung: abstimmungId ?? '',
        terminvorschlag: r.id,
        teilnehmer: teilnehmerId ?? '',
        verfuegbarkeit: answers[r.id]?.verfuegbarkeit ?? '',
        kommentar: answers[r.id]?.kommentar || undefined,
        antwortzeitpunkt: nowIso(),
        letzte_aenderung: nowIso(),
      }),
    })),
    ...(hasAlt ? [{
      key: 'alternative', entity: 'alternative_terminvorschlaege' as const, form: alt,
      primary: answered.length === 0,
    }] : []),
  ];
  const submit = useJourneySubmit(port, plan, { draftKey: 'abstimmung-teilnehmen' });

  const items: SummaryItem[] = answered.map(r => ({
    key: `a_${r.id}`,
    label: fmt(fieldDate(r, 'startzeit')),
    value: [label(answers[r.id]?.verfuegbarkeit ?? null), answers[r.id]?.kommentar].filter(Boolean).join(' — '),
    step: 1,
  }));

  const setAnswer = (id: string, patch: Partial<Answer>) =>
    setAnswers(a => ({ ...a, [id]: { verfuegbarkeit: a[id]?.verfuegbarkeit ?? null, kommentar: a[id]?.kommentar ?? '', ...patch } }));

  if (!abstimmungId || !teilnehmerId) {
    return (
      <PublicShell title={page.title} description={page.description}>
        <p className="text-sm text-muted-foreground">
          {tx('Dieser Link ist unvollständig. Bitte öffne den persönlichen Abstimmungslink aus deiner Einladung.')}
        </p>
      </PublicShell>
    );
  }

  const steps = [
    { label: tx('Terminvorschläge') },
    { label: tx('Alternative') },
    { label: tx('Prüfen') },
  ];

  return (
    <PublicShell title={page.title} description={page.description}>
      <IntentWizardShell steps={steps} currentStep={step} onStepChange={setStep} back={false} forms={[alt]} draftKey="abstimmung-teilnehmen">
        {step === 1 && !submit.result && (
          <div className="space-y-4">
            {sorted.length === 0 && (
              <p className="text-sm text-muted-foreground">{tx('Aktuell gibt es keine Terminvorschläge.')}</p>
            )}
            {sorted.map(r => {
              const a = answers[r.id];
              const ort = fieldText(r, 'ort_abweichend');
              return (
                <div key={r.id} className="space-y-3 rounded-xl border p-4">
                  <div>
                    <div className="font-medium">
                      {fmt(fieldDate(r, 'startzeit'))} – {fmt(fieldDate(r, 'endzeit'))}
                    </div>
                    {ort && <div className="text-sm text-muted-foreground">{ort}</div>}
                  </div>
                  <ChoiceGroup
                    id={`vf_${r.id}`}
                    value={a?.verfuegbarkeit ?? null}
                    onChange={k => setAnswer(r.id, { verfuegbarkeit: k })}
                    options={options}
                    allowClear
                  />
                  <Textarea
                    rows={2}
                    placeholder={tx('Kommentar (optional)')}
                    value={a?.kommentar ?? ''}
                    onChange={e => setAnswer(r.id, { kommentar: e.target.value })}
                  />
                </div>
              );
            })}
            <StepNav
              hideBack
              nextStepLabel={tx('Alternative')}
              onNext={() => (answered.length > 0 || hasAlt) ? true : tx('Bitte beantworte mindestens einen Terminvorschlag.')}
            />
          </div>
        )}
        {step === 2 && !submit.result && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{tx('Keiner der Termine passt? Schlage optional einen eigenen Termin vor.')}</p>
            <Bound form={alt} name="startzeit" />
            <Bound form={alt} name="endzeit" />
            <Bound form={alt} name="kommentar" />
            <StepNav
              onBack={() => setStep(1)}
              nextStepLabel={tx('Prüfen')}
              onNext={() => {
                if (!hasAlt) return true;
                if (!alt.get('startzeit') || !alt.get('endzeit')) return alt.validate(['startzeit', 'endzeit']);
                return true;
              }}
            />
          </div>
        )}
        {step === 3 && !submit.done && (
          <SummaryStep
            forms={[alt]}
            items={items}
            submit={submit}
            whatHappensNext={tx('Deine Antworten werden gespeichert und dem Organisator angezeigt.')}
          />
        )}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[alt]}
            title={tx('Danke für deine Rückmeldung')}
            actions={{ copy: false, print: false }}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
