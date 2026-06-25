import { NextResponse } from "next/server";
import { z } from "zod";
import { setAdminSession, verifyPassword } from "@/lib/auth";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 400 });

  const username = process.env.ADMIN_USERNAME || "bodegon";
  if (parsed.data.username.trim().toLocaleLowerCase("es") !== username.trim().toLocaleLowerCase("es") || !verifyPassword(parsed.data.password)) {
    return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
  }

  await setAdminSession(username);
  return NextResponse.json({ ok: true, username });
}
