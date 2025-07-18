import { NextResponse } from "next/server";
import { APP_OG_IMAGE_URL } from "@/src/lib/constants";

export async function GET() {
  // For now, just redirect to the normal APP_OG_IMAGE_URL
  return NextResponse.redirect(APP_OG_IMAGE_URL);
}
