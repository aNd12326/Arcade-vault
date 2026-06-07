import { NextRequest, NextResponse } from "next/server";
import { insertScore } from "@/app/_lib/supabase/queries";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { gameId, nickname, score } = body as Record<string, unknown>;

  if (
    typeof nickname !== "string" ||
    nickname.trim().length === 0 ||
    nickname.length > 20
  ) {
    return NextResponse.json(
      { error: "nickname must be 1–20 characters" },
      { status: 400 }
    );
  }

  if (typeof score !== "number" || !Number.isInteger(score) || score < 0) {
    return NextResponse.json(
      { error: "score must be a non-negative integer" },
      { status: 400 }
    );
  }

  if (typeof gameId !== "string" || gameId.trim().length === 0) {
    return NextResponse.json({ error: "gameId is required" }, { status: 400 });
  }

  try {
    await insertScore(gameId, nickname.trim(), score);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
