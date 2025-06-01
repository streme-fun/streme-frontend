import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ address: string }> }
) {
  const { address } = await context.params;

  console.log(`[Video Gen] Starting generation for token: ${address}`);

  try {
    // Determine the base URL
    const host = request.headers.get("host");
    const protocol = host?.includes("localhost") ? "http" : "https";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    // Fetch token data
    const tokenApiUrl = `${baseUrl}/api/tokens/single?address=${address}`;
    const tokenResponse = await fetch(tokenApiUrl, {
      cache: "no-store",
      headers: {
        "User-Agent": "Streme-Video-Generator/1.0",
        Accept: "application/json",
      },
    });

    if (!tokenResponse.ok) {
      throw new Error(`API returned ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const token = tokenData.data;

    if (!token) {
      throw new Error("No token data found");
    }

    // Create temporary directory for video processing
    const tempDir = path.join(process.cwd(), "temp", address);
    await fs.promises.mkdir(tempDir, { recursive: true });

    const backgroundVideo = path.join(process.cwd(), "public", "stream.mp4");
    const outputVideo = path.join(tempDir, "output.mp4");

    // Check if background video exists
    if (!fs.existsSync(backgroundVideo)) {
      throw new Error("Background video stream.mp4 not found");
    }

    let ffmpegCommand: string;

    if (token.img_url) {
      // Download token image
      const imageResponse = await fetch(token.img_url);
      if (!imageResponse.ok) {
        throw new Error("Failed to fetch token image");
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const tempImage = path.join(tempDir, "token-image.png");
      await fs.promises.writeFile(tempImage, Buffer.from(imageBuffer));

      // FFmpeg command to overlay token image on video
      ffmpegCommand = `ffmpeg -i "${backgroundVideo}" -i "${tempImage}" -filter_complex "[1:v]scale=400:400[overlay];[0:v][overlay]overlay=(W-w)/2:(H-h)/2" -c:a copy -c:v libx264 -t 10 -y "${outputVideo}"`;
    } else {
      // Create text overlay for tokens without images
      const symbolText = token.symbol?.[0] ?? "?";
      ffmpegCommand = `ffmpeg -i "${backgroundVideo}" -vf "drawtext=text='${symbolText}':fontsize=120:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:fontfile=/System/Library/Fonts/Arial.ttf" -c:a copy -c:v libx264 -t 10 -y "${outputVideo}"`;
    }

    console.log(`[Video Gen] Running FFmpeg command: ${ffmpegCommand}`);

    // Execute FFmpeg command
    await execAsync(ffmpegCommand);

    // Read the generated video
    const videoBuffer = await fs.promises.readFile(outputVideo);

    // Clean up temporary files
    await fs.promises.rm(tempDir, { recursive: true, force: true });

    console.log(`[Video Gen] Video generated successfully`);

    return new NextResponse(videoBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "public, immutable, no-transform, max-age=300",
        "Content-Length": videoBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("[Video Gen] Error:", error);

    // Fallback to original video
    try {
      const fallbackVideo = path.join(process.cwd(), "public", "stream.mp4");
      if (fs.existsSync(fallbackVideo)) {
        const videoBuffer = await fs.promises.readFile(fallbackVideo);
        return new NextResponse(videoBuffer, {
          headers: {
            "Content-Type": "video/mp4",
            "Cache-Control": "public, max-age=300",
          },
        });
      }
    } catch (fallbackError) {
      console.error("[Video Gen] Fallback error:", fallbackError);
    }

    return new NextResponse(
      `Video generation error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/plain",
        },
      }
    );
  }
}
