import { NextResponse } from "next/server";
import { APP_URL } from "@/src/lib/constants";

export async function GET() {
  // Use the QR-specific OG image for crowdfund
  const qrOgImageUrl = `${APP_URL}/qr-og.png`;
  return NextResponse.redirect(qrOgImageUrl);
}
