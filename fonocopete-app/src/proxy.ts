import { NextResponse, type NextRequest } from "next/server";

const canonicalHost = "fonocopeteconcepcion.cl";
const duplicateHosts = new Set(["fonocopete-app.vercel.app", "www.fonocopeteconcepcion.cl"]);

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0].toLowerCase();
  if (!host || !duplicateHosts.has(host)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.hostname = canonicalHost;
  url.port = "";

  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)"],
};
