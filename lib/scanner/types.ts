export type Point = { x: number; y: number };

export type Contour = Point[];

export type BBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Mask = {
  width: number;
  height: number;
  data: Uint8Array;
};

export type ReferenceKind = 'a4' | 'card' | 'coin_gbp_1';

export type ReferenceObject = {
  kind: ReferenceKind;
  label: string;
  longMm: number;
  shortMm: number;
};

export type FootMetrics = {
  lengthMm: number;
  widthMm: number;
  confidence: number;
};

export type ScanResult = FootMetrics & {
  imageUri: string;
  reference: ReferenceKind;
};

export type DetectedContours = {
  reference: Point[];
  foot: Point[];
};
