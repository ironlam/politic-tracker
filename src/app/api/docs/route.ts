import { NextResponse } from "next/server";
import { openapiSpec } from "@/lib/openapi";
import { withCache } from "@/lib/cache";

export async function GET() {
  return withCache(NextResponse.json(openapiSpec), "static");
}
