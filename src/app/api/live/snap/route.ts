import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, gt, lt, notInArray, or, sql } from "drizzle-orm";
import { db, liveSnaps, liveWatch } from "@/db";
import { getCurrentUser } from "@/modules/auth/guard";

export const dynamic = "force-dynamic";
const MAX_SNAPS = 10;
const KEEP_MS = 5 * 60_000;
const MAX_CHARS = 220_000; // ~160 KB de imagem: já comprimida, nunca chega perto
const LEASE_MS = 15_000;

/** A pessoa observada envia a foto da própria tela. Só vale enquanto houver licença do Adm. */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.mustChangePassword) return NextResponse.json({ keep: false }, { status: 401 });
  const [w] = await db.select({ u: liveWatch.until }).from(liveWatch).where(and(eq(liveWatch.userId, me.id), gt(liveWatch.until, new Date())));
  if (!w) return NextResponse.json({ keep: false });
  const body = (await req.json().catch(() => null)) as { image?: unknown; path?: unknown } | null;
  const image = typeof body?.image === "string" ? body.image : "";
  if (!/^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > MAX_CHARS) return NextResponse.json({ keep: true });
  await db.insert(liveSnaps).values({ userId: me.id, image, path: typeof body?.path === "string" ? body.path.slice(0, 200) : null });
  // rodízio: some o que passou de 5 min e tudo além das 10 mais novas
  const newest = await db.select({ id: liveSnaps.id }).from(liveSnaps).where(eq(liveSnaps.userId, me.id)).orderBy(desc(liveSnaps.id)).limit(MAX_SNAPS);
  await db.delete(liveSnaps).where(and(eq(liveSnaps.userId, me.id), or(lt(liveSnaps.createdAt, new Date(Date.now() - KEEP_MS)), notInArray(liveSnaps.id, newest.map((n) => n.id)))));
  return NextResponse.json({ keep: true });
}

/** O Adm pede a foto mais recente (e renova a licença de observação). */
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me?.isAdmin) return NextResponse.json({}, { status: 403 });
  const uid = Number(req.nextUrl.searchParams.get("uid"));
  const after = Number(req.nextUrl.searchParams.get("after")) || 0;
  if (!Number.isInteger(uid) || uid <= 0) return NextResponse.json({}, { status: 400 });
  const until = new Date(Date.now() + LEASE_MS);
  await db.insert(liveWatch).values({ userId: uid, until }).onConflictDoUpdate({ target: liveWatch.userId, set: { until } });
  const [s] = await db.select().from(liveSnaps).where(and(eq(liveSnaps.userId, uid), gt(liveSnaps.id, after), gt(liveSnaps.createdAt, sql`now() - interval '5 minutes'`))).orderBy(desc(liveSnaps.id)).limit(1);
  return NextResponse.json(s ? { id: s.id, image: s.image, path: s.path, at: s.createdAt.toISOString() } : {}, { headers: { "Cache-Control": "no-store" } });
}
