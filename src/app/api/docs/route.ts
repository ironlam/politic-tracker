import { NextResponse } from "next/server";
import { openapiSpec } from "@/lib/openapi";
import { withCache } from "@/lib/cache";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET() {
  return withCache(NextResponse.json(openapiSpec, { headers: corsHeaders }), "static");
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
