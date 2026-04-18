import { ReferenceKind, ReferenceObject } from './types';

export const REFERENCE_OBJECTS: Record<ReferenceKind, ReferenceObject> = {
  a4: { kind: 'a4', label: 'A4 paper', longMm: 297, shortMm: 210 },
  card: { kind: 'card', label: 'Credit / ID card', longMm: 85.6, shortMm: 53.98 },
  coin_gbp_1: { kind: 'coin_gbp_1', label: 'UK £1 coin', longMm: 23.43, shortMm: 23.43 },
};

export function getReferenceObject(kind: ReferenceKind): ReferenceObject {
  return REFERENCE_OBJECTS[kind];
}
