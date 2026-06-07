import { type NextRequest, NextResponse } from "next/server";
import { getSections } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const subject = req.nextUrl.searchParams.get("subject") ?? "bs";
  try {
    const sections = getSections(subject);
    return NextResponse.json({ sections });
  } catch (err) {
    console.error("DB error:", err);
    return NextResponse.json({ error: "Failed to load sections" }, { status: 500 });
  }
}
