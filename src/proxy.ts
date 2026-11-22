import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readToken } from "@/modules/auth/token";

/** Porteiro: quem não está logado só vê a tela de login. */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await readToken(token) : null;

  if (!session && pathname !== "/login" && pathname !== "/api/precache") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  // /login com cookie válido NÃO é redirecionado aqui: o cookie pode ser de um usuário bloqueado,
  // apagado ou com cargo/senha alterados (a página de login confere no banco). Redirecionar causava loop.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
