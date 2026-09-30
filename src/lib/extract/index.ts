import * as XLSX from "xlsx";
import { extractText, getDocumentProxy } from "unpdf";
import { docxToText } from "./docx";
import { parseQuestionsFromRows, parseQuestionsFromText } from "./parse";
import type { ExtractionResult, SheetRows } from "./types";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".xls", ".csv", ".txt"] as const;

export class UnsupportedFileError extends Error {}

/** Reads an uploaded file and pulls out only its quiz questions. */
export async function extractQuestions(fileName: string, buffer: Buffer): Promise<ExtractionResult> {
  const ext = fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";

  switch (ext) {
    case ".pdf": {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      if (!text.trim()) {
        throw new UnsupportedFileError(
          "This PDF has no readable text — it's probably a scan or photo. Save the original Word file or a text-based PDF and upload that instead.",
        );
      }
      return parseQuestionsFromText(text);
    }
    case ".docx":
      return parseQuestionsFromText(await docxToText(buffer));
    case ".xlsx":
    case ".xls": {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      return mergeSheets(workbook);
    }
    case ".csv": {
      const workbook = XLSX.read(buffer.toString("utf8").replace(/^﻿/, ""), { type: "string" });
      return mergeSheets(workbook);
    }
    case ".txt":
      return parseQuestionsFromText(buffer.toString("utf8"));
    case ".doc":
      throw new UnsupportedFileError(
        "Old Word files (.doc) can't be read. Open it in Word and use Save As → Word Document (.docx).",
      );
    default:
      throw new UnsupportedFileError(
        `This file type isn't supported. Upload one of: ${SUPPORTED_EXTENSIONS.join(", ")}.`,
      );
  }
}

function mergeSheets(workbook: XLSX.WorkBook): ExtractionResult {
  const merged: ExtractionResult = { title: null, questions: [], skipped: [] };
  for (const name of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[name], {
      header: 1,
      defval: "",
      raw: false,
    }) as SheetRows;
    const result = parseQuestionsFromRows(rows);
    merged.title ??= result.title;
    merged.questions.push(...result.questions);
    merged.skipped.push(...result.skipped);
  }
  return merged;
}
