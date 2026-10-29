// Auto-generated. Per-entity form-enhancements config for "Terminabstimmungen".
// Written by the backend form polish (app/services/form_polish.py) from the
// generator's manifest; scripts/parse-formulas.mjs expands the formula strings.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [{"row": ["abstimmungsnummer", "titel"], "cols": "1fr 2fr"}, {"row": ["organisator_vorname", "organisator_nachname"]}, "organisator_email", "status", "entscheidungsregel", "zeitzone", "standarddauer_minuten", "antwortfrist", "ort", "online_meeting_link", "finaler_terminvorschlag", {"row": ["festgelegt_am", "abgesagt_am"], "cols": "1fr 1fr"}, "kalenderuebertragung", "bestaetigung_sofort_senden", "einladungen_durch_kalender", {"row": ["google_kalender_id", "outlook_kalender_id"], "cols": "1fr 1fr"}, {"row": ["ics_sequenz", "aufbewahrung_bis"], "cols": "1fr 1fr"}, "beschreibung", "entscheidungskommentar"],
  defaults: {
    'status': { kind: 'lookup', key: 'entwurf', label: 'Entwurf' },
    'antwortfrist': { kind: 'todayOffset', days: 7, withTime: true },
    'standarddauer_minuten': { kind: 'literal', value: 60 },
    'zeitzone': { kind: 'lookup', key: 'europe_berlin', label: 'Europe/Berlin' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
