/**
 * Keep client export requests aligned with the authenticated CSV route.
 * Only CSV is available; unsupported formats must not silently downgrade.
 */
export type ExportDateRange = 'all' | '7d' | '30d' | 'year';

export interface ExportRequest {
  ownerAddress: string;
  dateRange: ExportDateRange;
  format?: 'csv';
  columns?: readonly string[];
}

export function buildCommitmentsExportUrl({
  ownerAddress,
  dateRange,
  format = 'csv',
  columns,
}: ExportRequest): string {
  const params = new URLSearchParams({
    ownerAddress: ownerAddress.trim(),
    dateRange,
    format,
  });
  if (columns?.length) params.set('columns', columns.join(','));
  return `/api/commitments/export?${params.toString()}`;
}
