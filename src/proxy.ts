import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readToken } from "@/modules/auth/token";

/** Porteiro: quem não está logado só vê a tela de login. */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await readToken(token) : null;

  if (!session && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/painel", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
