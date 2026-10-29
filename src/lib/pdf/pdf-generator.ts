import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { CostSheetDocument } from './cost-sheet-document';
import { PropertyBrochureDocument } from './property-brochure-document';
import type { CostSheetProps, PropertyBrochureProps } from './types';

/**
 * Compiles an agency-branded Cost Sheet React-PDF document into a Blob.
 */
export async function generateCostSheetPdf(
  props: CostSheetProps
): Promise<Blob> {
  const element = React.createElement(CostSheetDocument, props);
  // pdf() accepts a ReactElement and returns an instance with .toBlob()
  // @react-pdf/renderer's pdf() type definitions require ReactElement<DocumentProps>
  return await pdf(element as unknown as Parameters<typeof pdf>[0]).toBlob();
}

/**
 * Compiles a branded Property Brochure React-PDF document into a Blob.
 */
export async function generatePropertyBrochurePdf(
  props: PropertyBrochureProps
): Promise<Blob> {
  const element = React.createElement(PropertyBrochureDocument, props);
  return await pdf(element as unknown as Parameters<typeof pdf>[0]).toBlob();
}

/**
 * Triggers a browser download of the generated PDF Blob.
 */
export function downloadPdfBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
