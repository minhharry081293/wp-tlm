export type CsvLinkRow = {
  targetUrl: string;
  anchorText: string;
  line: number;
};

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function looksLikeHeader(cols: string[]): boolean {
  if (cols.length < 2) return false;
  const a = cols[0].toLowerCase().replace(/^\ufeff/, "");
  const b = cols[1].toLowerCase();
  return (
    (a === "anchor" && (b === "text" || b === "anchor_text" || b === "keyword")) ||
    (a === "url" && b === "text") ||
    (a === "target_url" && b === "anchor_text")
  );
}

export function parseCsvLinks(csvText: string, maxRows = 300): CsvLinkRow[] {
  const lines = csvText
    .replace(/^\ufeff/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error("CSV is empty");
  }

  let start = 0;
  const firstCols = splitCsvLine(lines[0]);
  if (looksLikeHeader(firstCols)) {
    start = 1;
  }

  const dataLines = lines.slice(start);
  if (dataLines.length === 0) {
    throw new Error("CSV has no data rows");
  }
  if (dataLines.length > maxRows) {
    throw new Error(`CSV exceeds maximum of ${maxRows} rows (got ${dataLines.length})`);
  }

  const rows: CsvLinkRow[] = [];
  for (let i = 0; i < dataLines.length; i++) {
    const cols = splitCsvLine(dataLines[i]);
    if (cols.length < 2) {
      throw new Error(`Line ${start + i + 1}: expected 2 columns (anchor,text)`);
    }
    // CSV: anchor = target URL, text = anchor text
    const targetUrl = cols[0].replace(/^"|"$/g, "").trim();
    const anchorText = cols[1].replace(/^"|"$/g, "").trim();
    if (!targetUrl || !anchorText) {
      throw new Error(`Line ${start + i + 1}: both columns are required`);
    }
    try {
      // eslint-disable-next-line no-new
      new URL(targetUrl);
    } catch {
      throw new Error(`Line ${start + i + 1}: invalid URL "${targetUrl}"`);
    }
    rows.push({
      targetUrl,
      anchorText,
      line: start + i + 1,
    });
  }
  return rows;
}
