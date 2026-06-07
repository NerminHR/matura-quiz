import { NextRequest, NextResponse } from "next/server";
import { getRandomQuestions } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const count = Math.min(Math.max(parseInt(searchParams.get("count") ?? "20", 10), 1), 200);
  const section = searchParams.get("section") ?? "all";
  const subject = searchParams.get("subject") ?? "bs";

  try {
    const questions = getRandomQuestions(count, section, subject);
    return NextResponse.json({ questions });
  } catch (err) {
    console.error("DB error:", err);
    return NextResponse.json({ error: "Failed to load questions" }, { status: 500 });
  }
}

