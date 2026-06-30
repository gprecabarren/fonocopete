import { NextResponse } from "next/server";
import { getAdminSession, setAdminSession } from "@/lib/auth";

export async function GET() {
  const session = await getAdminSession();
  if (session) {
    await setAdminSession(session.username);
  }
  return NextResponse.json({ authenticated: Boolean(session), username: session?.username ?? null });
}
