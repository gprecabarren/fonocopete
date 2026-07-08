import { NextResponse } from "next/server";
import { getAdminSession, setAdminSession } from "@/lib/auth";
import { noStoreHeaders } from "@/lib/no-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await getAdminSession();
  if (session) {
    await setAdminSession(session.username);
  }
  return NextResponse.json({ authenticated: Boolean(session), username: session?.username ?? null }, { headers: noStoreHeaders });
}
