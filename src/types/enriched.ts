import type { AlternativeTerminvorschlaege, Rueckmeldungen, Teilnehmer, Terminabstimmungen, Terminvorschlaege } from './app';

export type EnrichedTerminabstimmungen = Terminabstimmungen & {
  finaler_terminvorschlagName: string;
};

export type EnrichedTerminvorschlaege = Terminvorschlaege & {
  terminabstimmungName: string;
};

export type EnrichedTeilnehmer = Teilnehmer & {
  terminabstimmungName: string;
};

export type EnrichedRueckmeldungen = Rueckmeldungen & {
  terminabstimmungName: string;
  terminvorschlagName: string;
  teilnehmerName: string;
};

export type EnrichedAlternativeTerminvorschlaege = AlternativeTerminvorschlaege & {
  terminabstimmungName: string;
  vorgeschlagen_vonName: string;
};
