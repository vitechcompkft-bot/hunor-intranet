'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ExportColumn<T> {
  header: string;
  /** mező kulcs vagy számított érték */
  value: (row: T) => string | number | null | undefined;
}

/** Táblázat exportálása PDF-be (fekvő A4, autoTable). */
export function exportTablePdf<T>(
  title: string,
  columns: ExportColumn<T>[],
  rows: T[],
  filename: string
) {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(title, 14, 16);

  autoTable(doc, {
    startY: 22,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => String(c.value(r) ?? ''))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [22, 163, 74] }, // brand-600
    alternateRowStyles: { fillColor: [240, 253, 244] }, // brand-50
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/** Táblázat exportálása Excel (.xlsx) fájlba. */
export function exportTableExcel<T>(
  sheetName: string,
  columns: ExportColumn<T>[],
  rows: T[],
  filename: string
) {
  const aoa = [
    columns.map((c) => c.header),
    ...rows.map((r) => columns.map((c) => c.value(r) ?? '')),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/** Tetszőleges 2D tömb CSV-be (UTF-8 BOM-mal, Excel-kompatibilis). */
export function exportCsv(rows: (string | number)[][], filename: string) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '');
          return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(';')
    )
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
