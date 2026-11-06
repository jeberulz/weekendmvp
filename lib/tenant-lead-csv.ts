/** Prefix spreadsheet formulas so an untrusted lead field cannot execute. */
export function csvCell(value: string): string {
  const safe = /^[\s\uFEFF]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export type ExportLead = {
  id: string;
  email: string;
  createdAt: number;
  consentText?: string;
  consentVersion?: string;
  doubleOptInAt?: number;
  source?: string;
};

export const LEAD_CSV_HEADER =
  "lead_id,email,created_at,consent_version,consent_text,double_opt_in_at,source\r\n";

export function leadCsvRow(lead: ExportLead): string {
  const fields = [
    lead.id,
    lead.email,
    new Date(lead.createdAt).toISOString(),
    lead.consentVersion ?? "",
    lead.consentText ?? "",
    lead.doubleOptInAt === undefined ? "" : new Date(lead.doubleOptInAt).toISOString(),
    lead.source ?? "",
  ];
  return `${fields.map(csvCell).join(",")}\r\n`;
}
