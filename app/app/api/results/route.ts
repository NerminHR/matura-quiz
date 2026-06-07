import { NextRequest, NextResponse } from "next/server";
import { saveResultAndGetLeaderboard } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userName, subject, sectionFilter, questionCount, correctCount, timeSeconds } = body;

  if (
    !userName || typeof userName !== "string" ||
    !subject || typeof subject !== "string" ||
    typeof questionCount !== "number" ||
    typeof correctCount !== "number" ||
    typeof timeSeconds !== "number"
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const result = saveResultAndGetLeaderboard({
      userName: userName.slice(0, 50),
      subject,
      sectionFilter: sectionFilter ?? null,
      questionCount,
      correctCount,
      timeSeconds: Math.max(0, Math.min(timeSeconds, 7200)),
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("DB error:", err);
    return NextResponse.json({ error: "Failed to save result" }, { status: 500 });
  }
}
