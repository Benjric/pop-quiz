export type ExtractedQuestion = {
  text: string;
  choices: string[];
  /** Null when the file doesn't say which choice is right. */
  correctIndex: number | null;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE";
};

export type SkippedItem = {
  excerpt: string;
  reason: string;
};

export type ExtractionResult = {
  title: string | null;
  questions: ExtractedQuestion[];
  skipped: SkippedItem[];
};

/** Rows from a spreadsheet or CSV, one array of cell strings per row. */
export type SheetRows = string[][];
