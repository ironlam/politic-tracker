import { NextResponse } from "next/server";
import { openapiSpec } from "@/lib/openapi";

export async function GET() {
  return NextResponse.json(openapiSpec);
}
