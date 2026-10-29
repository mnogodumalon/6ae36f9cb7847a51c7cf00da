// Kanban over the status lookup (Terminabstimmungen is the hub: Vorschläge, Teilnehmer, Rückmeldungen
// hang off it). Hero = expired-but-undecided polls; aside slices TIME (Frist naht) and PEOPLE (ohne Antwort).
import { useMemo, useState } from 'react';
import { differenceInHours, parseISO } from 'date-fns';
import { IconAlertTriangle, IconCalendarEvent, IconChecks, IconClockHour4, IconPlus, IconUsers } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { flowActionFor } from '@/config/plan';
import type { Terminabstimmungen } from '@/types/app';
import { LOOKUP_OPTIONS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import { formatDateTime, lookupKey } from '@/lib/formatters';
import { tx } from '@/i18n';
import { gruss, namen, undoToast, useClock } from '@/lib/polish';
import { Button } from '@/components/ui/button';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { KanbanWidget, type KanbanCard, type KanbanColumn, type KanbanTone } from '@/components/widgets/KanbanWidget';

type Filter = 'all' | 'pending' | 'soon';

const OPEN = ['versendet', 'in_abstimmung'];

// The next workflow step of a poll — one helper for hero, work lists and overlay footer.
// Status changes belong to flows, so the helper OPENS the flow.
function nextStep(r: Terminabstimmungen): { label: string; onClick: () => void } | undefined {
  const st = lookupKey(r.fields.status);
  if (st === 'entwurf') {
    const go = flowActionFor('terminabstimmungen', 'status', r.record_id, 'versendet');
    return go ? { label: tx('Einladung versenden'), onClick: go } : undefined;
  }
  if (st === 'versendet' || st === 'in_abstimmung' || st === 'abgelaufen') {
    const go = flowActionFor('terminabstimmungen', 'status', r.record_id, 'festgelegt');
    return go ? { label: tx('Termin festlegen'), onClick: go } : undefined;
  }
  return undefined;
}

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { terminabstimmungen, terminvorschlaege, teilnehmer, rueckmeldungen } = data;
  const crud = useEntityCrud(data, {
    footer: (top) => (top.type === 'terminabstimmungen' ? nextStep(top.record) : undefined),
  });
  const clock = useClock();
  const [filter, setFilter] = useState<Filter>('all');

  const columns = useMemo<KanbanColumn[]>(
    () => (LOOKUP_OPTIONS['terminabstimmungen']?.['status'] ?? []).map(o => ({ key: o.key, label: o.label })),
    [],
  );

  // Per poll: counts, who has not answered, the chosen date.
  const infos = useMemo(() => {
    const answeredIds = new Set<string>();
    rueckmeldungen.forEach(r => { const id = extractRecordId(r.fields.teilnehmer); if (id) answeredIds.add(id); });
    const vorschlagById = new Map(terminvorschlaege.map(v => [v.record_id, v]));
    return terminabstimmungen.map(r => {
      const mine = teilnehmer.filter(t => extractRecordId(t.fields.terminabstimmung) === r.record_id);
      const missing = mine.filter(t => {
        const st = lookupKey(t.fields.einladungsstatus);
        return !(answeredIds.has(t.record_id) || st === 'geantwortet' || st === 'abgesagt' || t.fields.teilnahme_abgesagt);
      });
      const nVorschlaege = terminvorschlaege.filter(v => extractRecordId(v.fields.terminabstimmung) === r.record_id).length;
      const finalId = extractRecordId(r.fields.finaler_terminvorschlag);
      const finalStart = finalId ? vorschlagById.get(finalId)?.fields.startzeit : undefined;
      const status = lookupKey(r.fields.status) ?? 'entwurf';
      const frist = r.fields.antwortfrist ? parseISO(r.fields.antwortfrist) : null;
      const isOpen = OPEN.includes(status);
      const expired = isOpen && !!frist && frist.getTime() < clock.getTime();
      const hoursLeft = frist ? differenceInHours(frist, clock) : null;
      const soon = isOpen && !expired && hoursLeft !== null && hoursLeft <= 72;
      return { r, status, mine, missing, nVorschlaege, finalStart, frist, isOpen, expired, soon };
    });
  }, [terminabstimmungen, terminvorschlaege, teilnehmer, rueckmeldungen, clock]);

  const byId = useMemo(() => new Map(infos.map(i => [i.r.record_id, i])), [infos]);
  const title = (r: Terminabstimmungen) => r.fields.titel ?? r.fields.abstimmungsnummer ?? tx('Ohne Titel');

  const expired = infos.filter(i => i.expired);
  const open = infos.filter(i => i.isOpen && !i.expired);
  const pendingPeople = infos.filter(i => i.isOpen).reduce((n, i) => n + i.missing.length, 0);
  const invitedPeople = infos.filter(i => i.isOpen).reduce((n, i) => n + i.mine.length, 0);
  const quote = invitedPeople > 0 ? Math.round(((invitedPeople - pendingPeople) / invitedPeople) * 100) : null;
  const pendingPolls = infos.filter(i => i.isOpen && i.missing.length > 0);
  const soonPolls = infos.filter(i => i.soon);
  const nextFinal = infos
    .filter(i => i.status === 'festgelegt' && i.finalStart && parseISO(i.finalStart).getTime() >= clock.getTime())
    .sort((a, b) => (a.finalStart ?? '').localeCompare(b.finalStart ?? ''))[0];

  const visible = infos.filter(i => filter === 'all' || (filter === 'pending' ? i.isOpen && i.missing.length > 0 : i.soon));

  const cards = useMemo<KanbanCard[]>(() => {
    const toneFor = (st: string): KanbanTone => (st === 'festgelegt' ? 'success' : st === 'abgelaufen' ? 'warning' : st === 'versendet' || st === 'in_abstimmung' ? 'primary' : 'default');
    return visible
      .slice()
      .sort((a, b) => (a.frist?.getTime() ?? Infinity) - (b.frist?.getTime() ?? Infinity))
      .map(i => {
        let sub: string;
        if (i.status === 'festgelegt' && i.finalStart) sub = tx`Termin: ${formatDateTime(i.finalStart)}`;
        else if (i.isOpen || i.status === 'abgelaufen') sub = tx`Frist ${formatDateTime(i.r.fields.antwortfrist)} · ${i.missing.length} von ${i.mine.length} ohne Antwort`;
        else sub = tx`Vorschläge: ${i.nVorschlaege} · Teilnehmer: ${i.mine.length}`;
        return { id: `terminabstimmung:${i.r.record_id}`, column: i.status, title: title(i.r), subtitle: sub, tone: toneFor(i.status) };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const moveCard = (cardId: string, col: string) => {
    const id = cardId.split(':')[1];
    if (!id) return;
    const go = flowActionFor('terminabstimmungen', 'status', id, col);
    if (go) { go(); undoToast(tx('Ablauf geöffnet — bitte dort bestätigen')); return tx('Bitte im Ablauf bestätigen'); }
    return tx('Dieser Status wird im Ablauf oder in der Detailansicht gesetzt');
  };

  const openPoll = (id: string) => {
    const rec = terminabstimmungen.find(r => r.record_id === id);
    if (rec) crud.terminabstimmungen.openDetail(rec);
  };

  // Context line — names in every branch.
  let context: string;
  if (terminabstimmungen.length === 0) context = tx`Lege deine erste Terminabstimmung an und lade Teilnehmer ein.`;
  else if (expired.length > 0) context = tx`Bei ${namen(expired.map(i => title(i.r)))} ist die Frist abgelaufen — Zeit, einen Termin festzulegen.`;
  else if (pendingPolls.length > 0) {
    const names = namen(pendingPolls[0].missing.map(t => `${t.fields.vorname ?? ''} ${t.fields.nachname ?? ''}`.trim()));
    context = tx`Bei „${title(pendingPolls[0].r)}“ fehlt noch die Antwort von ${names}.`;
  } else if (nextFinal) context = tx`Nächster Termin: ${title(nextFinal.r)} am ${formatDateTime(nextFinal.finalStart)}.`;
  else context = tx`Alle Abstimmungen sind auf dem aktuellen Stand.`;

  const firstExpired = expired[0];
  const expiredStep = firstExpired ? nextStep(firstExpired.r) : undefined;

  const aside = (
    <>
      <WorkList
        title={tx('Frist naht')}
        items={soonPolls
          .slice()
          .sort((a, b) => (a.frist?.getTime() ?? 0) - (b.frist?.getTime() ?? 0))
          .map(i => {
            const step = nextStep(i.r);
            return {
              id: i.r.record_id,
              title: title(i.r),
              secondLine: (
                <>
                  <span className="font-medium text-amber-600">{tx`Frist ${formatDateTime(i.r.fields.antwortfrist)}`}</span>
                  <span className="text-muted-foreground">{tx` · ${i.missing.length} ausstehend`}</span>
                </>
              ),
              action: step,
            };
          })}
        onItemClick={openPoll}
        empty={{ text: nextFinal ? tx`Keine Frist in den nächsten 3 Tagen — nächster Termin: ${title(nextFinal.r)}` : tx`Keine Frist in den nächsten 3 Tagen.` }}
      />
      <WorkList
        title={tx('Ohne Rückmeldung')}
        items={pendingPolls.flatMap(i => i.missing.slice(0, 3).map(t => ({
          id: t.record_id,
          title: `${t.fields.vorname ?? ''} ${t.fields.nachname ?? ''}`.trim() || (t.fields.email ?? ''),
          secondLine: (
            <>
              <span className="font-medium text-muted-foreground">{lookupKey(t.fields.einladungsstatus) === 'nicht_versendet' ? tx('Nicht eingeladen') : tx('Wartet')}</span>
              <span className="text-muted-foreground"> · {title(i.r)}</span>
            </>
          ),
          action: { label: tx('Öffnen'), onClick: () => crud.teilnehmer.openDetail(t) },
        })))}
        onItemClick={id => { const t = teilnehmer.find(x => x.record_id === id); if (t) crud.teilnehmer.openDetail(t); }}
        empty={{ text: tx('Alle eingeladenen Teilnehmer haben geantwortet.') }}
      />
    </>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground mt-1">{context}</p>
        </div>
        {crud.terminabstimmungen.canWrite && (
          <Button onClick={() => crud.terminabstimmungen.openCreate({ status: 'entwurf' })}>
            <IconPlus size={16} className="shrink-0" />
            <span>{tx('Neue Terminabstimmung')}</span>
          </Button>
        )}
      </div>

      {terminabstimmungen.length === 0 ? (
        <div className="rounded-[27px] bg-card shadow-lg p-8 flex flex-col items-center text-center gap-3">
          <IconCalendarEvent size={48} className="text-muted-foreground" stroke={1.5} />
          <p className="text-sm text-muted-foreground max-w-md">{tx('Noch keine Terminabstimmung. Lege Terminvorschläge an, lade Teilnehmer ein und lege danach den finalen Termin fest.')}</p>
          {crud.terminabstimmungen.canWrite && (
            <Button onClick={() => crud.terminabstimmungen.openCreate({ status: 'entwurf' })}>{tx('Erste Terminabstimmung anlegen')}</Button>
          )}
        </div>
      ) : (
        <DashboardGrid
          variant="wide"
          hero={firstExpired && (
            <HeroBanner
              icon={<IconAlertTriangle size={18} />}
              action={expiredStep ?? { label: tx('Öffnen'), onClick: () => openPoll(firstExpired.r.record_id) }}
            >
              <b>{namen(expired.map(i => title(i.r)))}</b>{' '}
              {tx`— Antwortfrist abgelaufen (${formatDateTime(firstExpired.r.fields.antwortfrist)}), noch kein Termin festgelegt.`}
            </HeroBanner>
          )}
          kpis={(
            <StatStrip>
              <StatStripItem
                title={tx('Ohne Rückmeldung')}
                value={pendingPeople}
                icon={<IconUsers size={18} className="text-muted-foreground" />}
                tone={pendingPeople > 0 ? 'warning' : 'default'}
                onClick={() => setFilter(f => (f === 'pending' ? 'all' : 'pending'))}
                active={filter === 'pending'}
              />
              <StatStripItem
                title={tx('Frist in 3 Tagen')}
                value={soonPolls.length}
                icon={<IconClockHour4 size={18} className="text-muted-foreground" />}
                onClick={() => setFilter(f => (f === 'soon' ? 'all' : 'soon'))}
                active={filter === 'soon'}
              />
              {quote !== null && (
                <StatStripItem
                  title={tx('Rücklaufquote')}
                  value={`${quote} %`}
                  icon={<IconChecks size={18} className="text-muted-foreground" />}
                  tone={quote === 100 && open.length > 0 ? 'success' : 'default'}
                />
              )}
              {nextFinal && (
                <StatStripItem
                  title={tx('Nächster Termin')}
                  value={formatDateTime(nextFinal.finalStart)}
                  icon={<IconCalendarEvent size={18} className="text-muted-foreground" />}
                />
              )}
            </StatStrip>
          )}
          aside={aside}
          primary={(
            <KanbanWidget
              cards={cards}
              columns={columns}
              defaultCollapsed={['abgesagt', 'archiviert']}
              onCardClick={card => { const id = card.id.split(':')[1]; if (id && byId.has(id)) openPoll(id); }}
              onCardMove={moveCard}
              onAddCard={crud.terminabstimmungen.canWrite ? (col => crud.terminabstimmungen.openCreate({ status: col })) : undefined}
            />
          )}
        />
      )}
      {crud.surfaces}
    </div>
  );
}
