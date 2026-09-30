import { NextResponse } from "next/server";
import { extractQuestions, MAX_UPLOAD_BYTES, UnsupportedFileError } from "@/lib/extract";
import { getTeacherId } from "@/lib/session";
import { unauthorized } from "@/lib/api";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!(await getTeacherId())) return unauthorized();

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "That file is over 4 MB. Remove images from it, or split it into smaller files." },
      { status: 413 },
    );
  }

  try {
    const result = await extractQuestions(file.name, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ ...result, fileName: file.name });
  } catch (error) {
    if (error instanceof UnsupportedFileError) {
      return NextResponse.json({ error: error.message }, { status: 415 });
    }
    console.error("Extraction failed", error);
    return NextResponse.json(
      { error: "This file couldn't be read. Check that it opens normally, then try again." },
      { status: 422 },
    );
  }
}
