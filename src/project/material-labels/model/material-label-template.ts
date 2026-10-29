export interface MaterialLabelTemplateDesign {
  version: number;
  [key: string]: unknown;
}

export interface MaterialLabelTemplate {
  id: string;
  name: string;
  description: string | null;
  widthMm: number;
  heightMm: number;
  design: MaterialLabelTemplateDesign;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialLabelTemplateInput {
  id: string | null;
  name: string;
  description: string;
  widthMm: number;
  heightMm: number;
  design: MaterialLabelTemplateDesign;
  isDefault: boolean;
  isActive: boolean;
}

export interface MaterialLabelTemplatePreference {
  materialId: string;
  templateId: string | null;
  lastPrintedAt: string;
}

export interface MaterialLabelPrintSnapshot {
  materialId: string;
  templateId: string | null;
  templateSnapshot: MaterialLabelTemplate | null;
  previewSvg: string | null;
  lastPrintedAt: string;
}

export interface MaterialLabelTemplateRow extends MaterialLabelTemplate {
  sizeLabel: string;
  statusLabel: string;
  defaultLabel: string;
}
