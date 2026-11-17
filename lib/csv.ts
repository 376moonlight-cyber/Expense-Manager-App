import { z } from "zod";
import { normalizeCategoryName } from "@/lib/categories";

/** Escape a CSV cell (RFC 4180-style quoting). */
export function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Split one CSV line into fields, respecting double-quoted values. */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      fields.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  fields.push(current);
  return fields;
}

/** Split CSV text into non-empty lines (keeps quoted newlines out via line scan). */
export function splitCsvRows(text: string): string[] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i]!;
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }
    if (char === "\n" && !inQuotes) {
      if (current.trim().length > 0) rows.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim().length > 0) rows.push(current);
  return rows;
}

const REQUIRED_HEADERS = ["date", "description", "category", "amount"] as const;

export type ExpenseImportHeader = (typeof REQUIRED_HEADERS)[number];

export function mapExpenseImportHeaders(
  headerCells: string[],
): Record<ExpenseImportHeader, number> | { error: string } {
  const indexByName = new Map<string, number>();
  headerCells.forEach((cell, index) => {
    const key = cell.trim().toLowerCase();
    if (key) indexByName.set(key, index);
  });

  const missing = REQUIRED_HEADERS.filter((name) => !indexByName.has(name));
  if (missing.length > 0) {
    return {
      error: `Missing required column(s): ${missing.join(", ")}. Expected headers: date, description, category, amount.`,
    };
  }

  return {
    date: indexByName.get("date")!,
    description: indexByName.get("description")!,
    category: indexByName.get("category")!,
    amount: indexByName.get("amount")!,
  };
}

export const expenseImportRowSchema = z.object({
  date: z
    .string({ error: "Date must be a string" })
    .trim()
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Date must be a valid date",
    }),
  description: z
    .string({ error: "Description must be a string" })
    .trim()
    .min(1, { message: "Description is required" })
    .max(200, { message: "Description must be at most 200 characters" }),
  category: z
    .string({ error: "Category must be a string" })
    .trim()
    .min(1, { message: "Category is required" })
    .max(40, { message: "Category must be at most 40 characters" })
    .transform((value) => normalizeCategoryName(value)),
  amount: z
    .number({ error: "Amount must be a number" })
    .positive({ message: "Amount must be positive" })
    .finite({ message: "Amount must be a finite number" }),
});

export type ExpenseImportRow = z.infer<typeof expenseImportRowSchema>;

export type ParsedImportRow = {
  rowNumber: number;
  date: string;
  description: string;
  category: string;
  amount: number | null;
  raw: {
    date: string;
    description: string;
    category: string;
    amount: string;
  };
  status: "ok" | "error";
  error?: string;
};

function parseAmountCell(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return value;
}

/** Parse an expenses CSV into row previews with per-row errors. */
export function parseExpenseImportCsv(csvText: string): {
  rows: ParsedImportRow[];
  headerError?: string;
} {
  const lines = splitCsvRows(csvText);
  if (lines.length === 0) {
    return { rows: [], headerError: "CSV file is empty." };
  }

  const headerMap = mapExpenseImportHeaders(splitCsvLine(lines[0]!));
  if ("error" in headerMap) {
    return { rows: [], headerError: headerMap.error };
  }

  const rows: ParsedImportRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const rowNumber = i + 1;
    const cells = splitCsvLine(lines[i]!);
    const raw = {
      date: (cells[headerMap.date] ?? "").trim(),
      description: (cells[headerMap.description] ?? "").trim(),
      category: (cells[headerMap.category] ?? "").trim(),
      amount: (cells[headerMap.amount] ?? "").trim(),
    };

    const amount = parseAmountCell(raw.amount);
    const parsed = expenseImportRowSchema.safeParse({
      date: raw.date,
      description: raw.description,
      category: raw.category,
      amount: amount ?? Number.NaN,
    });

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid row.";
      rows.push({
        rowNumber,
        date: raw.date,
        description: raw.description,
        category: raw.category,
        amount,
        raw,
        status: "error",
        error: message,
      });
      continue;
    }

    rows.push({
      rowNumber,
      date: parsed.data.date,
      description: parsed.data.description,
      category: parsed.data.category,
      amount: parsed.data.amount,
      raw,
      status: "ok",
    });
  }

  return { rows };
}

export const importConfirmBodySchema = z.object({
  createMissingCategories: z.boolean({
    error: "createMissingCategories must be a boolean",
  }),
  rows: z
    .array(expenseImportRowSchema, {
      error: "rows must be an array",
    })
    .min(1, { message: "At least one valid row is required" })
    .max(5000, { message: "Import is limited to 5000 rows at a time" }),
});

export type ImportConfirmBody = z.infer<typeof importConfirmBodySchema>;

export const importPreviewBodySchema = z.object({
  csv: z
    .string({ error: "CSV must be a string" })
    .min(1, { message: "CSV content is required" })
    .max(5_000_000, { message: "CSV file is too large" }),
});
