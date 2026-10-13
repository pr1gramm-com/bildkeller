import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api/router";
import "@/lib/api/register-all";

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return handle(req, path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return handle(req, path);
}
