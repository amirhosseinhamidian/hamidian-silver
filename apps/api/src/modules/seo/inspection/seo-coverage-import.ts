import { BadRequestException } from '@nestjs/common';
import { crc32, inflateRawSync } from 'node:zlib';

export const COVERAGE_UPLOAD_LIMIT = 750 * 1024;
const maxRows = 1000;

function invalid(): never {
  throw new BadRequestException('Invalid or unsupported Search Console Coverage export.');
}

function zipTables(input: Buffer): Buffer[] {
  // Google export archives use a flat directory and stored or deflated CSV entries.
  const firstPossibleEnd = Math.max(0, input.length - 65_557);
  let end = input.length - 22;
  for (; end >= firstPossibleEnd; end--) {
    if (
      input.readUInt32LE(end) === 0x06054b50 &&
      end + 22 + input.readUInt16LE(end + 20) === input.length
    )
      break;
  }
  if (end < firstPossibleEnd || input.readUInt32LE(end + 4) !== 0) return invalid();
  const count = input.readUInt16LE(end + 10);
  const size = input.readUInt32LE(end + 12);
  let cursor = input.readUInt32LE(end + 16);
  if (count < 1 || count > 20 || cursor + size !== end || input.readUInt16LE(end + 8) !== count)
    return invalid();

  const directoryStart = cursor;
  const tables: Buffer[] = [];
  let expanded = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || input.readUInt32LE(cursor) !== 0x02014b50) return invalid();
    const flags = input.readUInt16LE(cursor + 8);
    const method = input.readUInt16LE(cursor + 10);
    const checksum = input.readUInt32LE(cursor + 16);
    const compressed = input.readUInt32LE(cursor + 20);
    const uncompressed = input.readUInt32LE(cursor + 24);
    const nameLength = input.readUInt16LE(cursor + 28);
    const next =
      cursor + 46 + nameLength + input.readUInt16LE(cursor + 30) + input.readUInt16LE(cursor + 32);
    if (next > end || (flags & 65) !== 0 || input.readUInt16LE(cursor + 34) !== 0) return invalid();
    const name = input.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    const local = input.readUInt32LE(cursor + 42);
    cursor = next;
    if (!/^(?:table|critical issues|non-critical issues)\.csv$/i.test(name)) continue;
    expanded += uncompressed;
    if (
      expanded > COVERAGE_UPLOAD_LIMIT ||
      local + 30 > directoryStart ||
      input.readUInt32LE(local) !== 0x04034b50 ||
      input.readUInt16LE(local + 8) !== method ||
      ![0, 8].includes(method)
    )
      return invalid();
    const nameStart = local + 30;
    const nameEnd = nameStart + input.readUInt16LE(local + 26);
    const dataStart = nameEnd + input.readUInt16LE(local + 28);
    const dataEnd = dataStart + compressed;
    if (dataEnd > directoryStart || input.toString('utf8', nameStart, nameEnd) !== name)
      return invalid();
    const data = input.subarray(dataStart, dataEnd);
    const bytes =
      method === 0 ? data : inflateRawSync(data, { maxOutputLength: Math.max(1, uncompressed) });
    if (bytes.length !== uncompressed || crc32(bytes) !== checksum) return invalid();
    tables.push(bytes);
  }
  if (cursor !== end || !tables.length) return invalid();
  return tables;
}

function csvRows(input: Buffer): string[][] {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(input);
  if (text.includes('\0')) return invalid();
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let closedQuote = false;

  const finishCell = () => {
    if (row.length >= 20 || cell.length > 2500) return invalid();
    row.push(cell.trim());
    cell = '';
    closedQuote = false;
  };
  const finishRow = () => {
    finishCell();
    if (row.some(Boolean)) rows.push(row);
    row = [];
    if (rows.length > maxRows + 1) return invalid();
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') cell += char;
      else if (text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = false;
        closedQuote = true;
      }
    } else if (char === ',' || char === '\n' || char === '\r') {
      if (char === ',') finishCell();
      else {
        if (char === '\r' && text[i + 1] === '\n') i++;
        finishRow();
      }
    } else if (closedQuote) return invalid();
    else if (char === '"') {
      if (cell.length) return invalid();
      quoted = true;
    } else cell += char;
  }
  if (quoted) return invalid();
  if (row.length || cell || closedQuote) finishRow();
  return rows;
}

export function coverageDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : null;
}

function coverageCrawlDate(value: string) {
  const numeric = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (numeric) {
    const [, month, day, year] = numeric;
    return coverageDate(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  }
  const english = /^([A-Za-z]{3}) (\d{1,2}), (\d{4})$/.exec(value);
  if (english) {
    const [, name, day, year] = english;
    const month =
      ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(
        name,
      ) + 1;
    return coverageDate(`${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`);
  }
  return coverageDate(value);
}

export type CoverageRow = {
  reason: string | null;
  url: string | null;
  lastCrawled: string | null;
  pages: number | null;
  validation: string | null;
};

function readTable(input: Buffer, origin: string, label: string): CoverageRow[] {
  const [headers, ...rows] = csvRows(input);
  if (!headers?.length || !rows.length) return invalid();
  const keys = headers.map((part) => part.toLowerCase());
  if (new Set(keys).size !== keys.length) return invalid();
  const urlIndex = keys.indexOf('url');
  const reasonIndex = keys.indexOf('reason');
  const pagesIndex = keys.indexOf('pages');
  if (urlIndex < 0 && (reasonIndex < 0 || pagesIndex < 0)) return invalid();
  const lastIndex = keys.findIndex((key) => ['last crawled', 'last crawl'].includes(key));
  const validationIndex = keys.indexOf('validation');

  return rows.map((row) => {
    if (row.length !== keys.length) return invalid();
    const reason = row[reasonIndex] || label;
    const validation = row[validationIndex] || null;
    if (reason.length > 240 || (validation?.length ?? 0) > 100) return invalid();
    if (urlIndex < 0) {
      const raw = row[pagesIndex];
      if (!/^\d+$|^\d{1,3}(?:,\d{3})+$/.test(raw)) return invalid();
      const pages = Number(raw.replaceAll(',', ''));
      if (!Number.isSafeInteger(pages)) return invalid();
      return { reason, url: null, lastCrawled: null, pages, validation };
    }
    const rawUrl = row[urlIndex];
    if (!rawUrl || rawUrl.length > 2000 || /[\\\u0000-\u001f]/.test(rawUrl)) return invalid();
    const url = new URL(rawUrl);
    if (url.origin !== origin || url.username || url.password || url.hash) return invalid();
    const rawDate = row[lastIndex];
    const lastCrawled =
      rawDate && rawDate !== '—' && rawDate !== '-' ? coverageCrawlDate(rawDate) : null;
    if (rawDate && !lastCrawled && rawDate !== '—' && rawDate !== '-') return invalid();
    return { reason, url: url.href, lastCrawled, pages: null, validation };
  });
}

export function parseCoverageUpload(input: Buffer, origin: string, label: string): CoverageRow[] {
  if (!input.length || input.length > COVERAGE_UPLOAD_LIMIT) return invalid();
  try {
    const zip = input.length >= 4 && input.readUInt32LE(0) === 0x04034b50;
    const tables = zip ? zipTables(input) : [input];
    const rows = tables.flatMap((table) => readTable(table, origin, label));
    if (!rows.length || rows.length > maxRows) return invalid();
    return rows;
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    return invalid();
  }
}
