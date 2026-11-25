import { afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, users } from "@/db";
import { syncAutoNotifications } from "@/modules/notifications/auto";

const reset = () => { (globalThis as unknown as { __autoNotif?: Map<number, number> }).__autoNotif?.clear(); };
let uid = 0, tid = 0;
afterAll(async () => {
  if (tid) await db.execute(sql`delete from tasks where id = ${tid}`);
  await db.execute(sql`delete from notifications where user_id = ${uid} and href = ${"/tarefas?t=" + tid}`);
});

describe("notificações automáticas", () => {
  it("tarefa atrasada avisa uma vez só", async () => {
    const [u] = await db.select({ id: users.id }).from(users).limit(1);
    uid = u.id;
    const [t] = await db.execute<{ id: number }>(sql`insert into tasks (user_id, title, due_at, kind, area) values (${uid}, 'tarefa de teste de aviso', now() - interval '1 hour', 'ligar', 'sdr') returning id`);
    tid = Number(t.id);
    reset(); await syncAutoNotifications(uid);
    reset(); await syncAutoNotifications(uid);
    const r = await db.execute<{ n: number }>(sql`select count(*)::int n from notifications where user_id = ${uid} and href = ${"/tarefas?t=" + tid}`);
    expect(r[0].n).toBe(1);
  });
});
