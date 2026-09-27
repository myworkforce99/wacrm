'use client';

import { useState, useRef } from 'react';
import * as xlsx from 'xlsx';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { parseBudget } from '@/lib/contacts/parse-budget';
import { ChevronLeft, Upload, TableProperties, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';

const CRM_FIELDS = [
  { id: 'ignore', label: '-- Ignore --' },
  { id: 'name', label: 'Name' },
  { id: 'phone', label: 'Mobile (Required)' },
  { id: 'email', label: 'Email' },
  { id: 'source', label: 'Source' },
  { id: 'budget_min', label: 'Budget Min' },
  { id: 'budget_max', label: 'Budget Max' },
  { id: 'location', label: 'Location' },
  { id: 'bhk_config', label: 'BHK Config' },
  { id: 'stage', label: 'Stage' },
  { id: 'notes', label: 'Notes' },
];

function smartMapHeader(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z]/g, '');
  if (h.includes('name')) return 'name';
  if (h.includes('phone') || h.includes('mobile') || h.includes('contact')) return 'phone';
  if (h.includes('email')) return 'email';
  if (h.includes('source')) return 'source';
  if (h.includes('min') && h.includes('budget')) return 'budget_min';
  if (h.includes('max') && h.includes('budget')) return 'budget_max';
  if (h.includes('budget')) return 'budget_min'; // fallback
  if (h.includes('location') || h.includes('city') || h.includes('area')) return 'location';
  if (h.includes('bhk') || h.includes('type') || h.includes('config')) return 'bhk_config';
  if (h.includes('stage') || h.includes('status')) return 'stage';
  if (h.includes('note')) return 'notes';
  return 'ignore';
}

function parseIndianMobile(raw: string): string {
  let cleaned = String(raw).replace(/[\s-]/g, '');
  if (cleaned.startsWith('0') && cleaned.length > 1) cleaned = cleaned.substring(1);
  if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  if (!cleaned.startsWith('+')) {
    return `+${cleaned}`;
  }
  return cleaned;
}

export default function ImportLeadsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { accountRole } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<any[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);

  if (accountRole !== 'owner' && accountRole !== 'admin') {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Admin access required to import leads.</p>
      </div>
    );
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = xlsx.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData: any[][] = xlsx.utils.sheet_to_json(ws, { header: 1 });

        if (rawData.length < 2) {
          toast.error('File must contain a header row and at least one data row.');
          return;
        }

        const h = rawData[0].map(String);
        const rows = rawData.slice(1).filter((r) => r.length > 0 && r.some((cell) => cell));

        if (rows.length > 2000) {
          toast.error('Max 2000 rows allowed for MVP.');
          return;
        }

        const initialMapping: Record<number, string> = {};
        h.forEach((header, idx) => {
          initialMapping[idx] = smartMapHeader(header);
        });

        setHeaders(h);
        setData(rows);
        setMapping(initialMapping);
        setStep(2);
      } catch (err) {
        console.error(err);
        toast.error('Failed to parse file. Ensure it is a valid CSV or Excel file.');
      }
    };
    reader.readAsBinaryString(f);
  };

  const handleImport = async () => {
    // Validate that mobile is mapped
    const hasPhone = Object.values(mapping).includes('phone');
    if (!hasPhone) {
      toast.error('You must map a column to Mobile (Required).');
      return;
    }

    setImporting(true);

    try {
      const payload = data.map((row) => {
        const mappedRow: any = {};
        headers.forEach((_, idx) => {
          const field = mapping[idx];
          if (field && field !== 'ignore') {
            const val = row[idx];
            if (val !== undefined && val !== null) {
              if (field === 'phone') mappedRow[field] = parseIndianMobile(val);
              else if (field === 'budget_min' || field === 'budget_max') mappedRow[field] = parseBudget(String(val));
              else mappedRow[field] = String(val);
            }
          }
        });
        return mappedRow;
      });

      const res = await fetch('/api/contacts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Import failed');

      setResult(json);
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred during import.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/contacts">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Import Leads</h1>
          <p className="text-muted-foreground text-sm">Upload CSV or Excel files to bulk-create contacts and lead details.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b pb-4">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
          <Upload className="size-4" /> <span>Upload</span>
        </div>
        <div className="h-px w-8 bg-border" />
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
          <TableProperties className="size-4" /> <span>Map Columns</span>
        </div>
        <div className="h-px w-8 bg-border" />
        <div className={`flex items-center gap-2 ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
          <PlayCircle className="size-4" /> <span>Result</span>
        </div>
      </div>

      {step === 1 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-24">
          <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xlsx" onChange={handleFileUpload} />
          <Upload className="mb-4 size-10 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-medium">Select a file to upload</h3>
          <p className="mb-6 text-sm text-muted-foreground">Supported formats: .csv, .xlsx (Max 2000 rows)</p>
          <Button onClick={() => fileInputRef.current?.click()}>Browse Files</Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3 font-medium">File Column Header</th>
                  <th className="p-3 font-medium">CRM Field</th>
                  <th className="p-3 font-medium text-muted-foreground">Preview (Row 1)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {headers.map((header, idx) => (
                  <tr key={idx}>
                    <td className="p-3 font-medium">{header}</td>
                    <td className="p-3">
                      <select
                        className="rounded-md border bg-background px-3 py-1.5 text-sm"
                        value={mapping[idx]}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [idx]: e.target.value }))}
                      >
                        {CRM_FIELDS.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="truncate p-3 max-w-[200px] text-muted-foreground">
                      {data[0] ? String(data[0][idx] || '') : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? 'Importing...' : `Import ${data.length} Leads`}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="rounded-lg border p-6 text-center space-y-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-100 text-green-600">
            <PlayCircle className="size-6" />
          </div>
          <h2 className="text-xl font-semibold">Import Complete</h2>
          <div className="flex justify-center gap-8 pt-4">
            <div>
              <p className="text-3xl font-bold text-green-600">{result.created}</p>
              <p className="text-sm text-muted-foreground">Imported</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-amber-500">{result.skipped}</p>
              <p className="text-sm text-muted-foreground">Skipped (Dupes)</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-red-500">{result.errors}</p>
              <p className="text-sm text-muted-foreground">Errors</p>
            </div>
          </div>
          <div className="pt-6">
            <Link href="/contacts">
              <Button>Go to Leads List</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
