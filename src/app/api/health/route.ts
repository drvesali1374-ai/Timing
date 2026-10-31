import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** GET /api/health — بررسی سلامت سرویس و اتصال پایگاه داده. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up", phase: 1 });
  } catch {
    return NextResponse.json({ status: "degraded", db: "down", phase: 1 }, { status: 503 });
  }
}
