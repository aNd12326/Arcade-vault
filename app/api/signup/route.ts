import { NextResponse } from "next/server";
import { createClient } from "../../_lib/supabase/server";
import { isStrongPassword } from "../../_lib/password";

interface SignupPayload {
  email: string;
  password: string;
  nickname: string;
  origin: string;
}

export async function POST(request: Request) {
  const body: SignupPayload = await request.json();
  const { email, password, nickname, origin } = body;

  const nick = (nickname ?? "").trim();
  if (nick.length < 1 || nick.length > 20) {
    return NextResponse.json(
      { ok: false, error: "El nickname debe tener entre 1 y 20 caracteres." },
      { status: 400 }
    );
  }

  // Política de contraseñas (defensa servidor, además del check en cliente).
  if (!isStrongPassword(password ?? "")) {
    return NextResponse.json(
      { ok: false, error: "Contraseña no cumple los requisitos." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("nickname", nick)
    .maybeSingle();
  if (taken) {
    return NextResponse.json(
      { ok: false, error: "Ese nickname ya está tomado." },
      { status: 409 }
    );
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nickname: nick },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) {
    // Map a uniqueness / already-registered failure (incl. the TOCTOU race the
    // pre-check above can miss) to a fixed message + 409. Never forward the raw
    // Postgres / Supabase error text to the client.
    const msg = error.message.toLowerCase();
    const isDuplicate =
      msg.includes("already registered") ||
      msg.includes("already exists") ||
      msg.includes("duplicate") ||
      msg.includes("unique");
    if (isDuplicate) {
      return NextResponse.json(
        { ok: false, error: "Ese nickname ya está tomado." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { ok: false, error: "No se pudo crear la cuenta." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
