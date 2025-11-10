export const APP_URL = process.env.NEXT_PUBLIC_URL!;
export const APP_NAME = process.env.NEXT_PUBLIC_FRAME_NAME;
export const APP_DESCRIPTION = process.env.NEXT_PUBLIC_FRAME_DESCRIPTION;
export const APP_PRIMARY_CATEGORY =
  process.env.NEXT_PUBLIC_FRAME_PRIMARY_CATEGORY;
export const APP_TAGS = process.env.NEXT_PUBLIC_FRAME_TAGS?.split(",");
export const APP_ICON_URL = `${APP_URL}/android-chrome-512x512.png`;
export const APP_OG_IMAGE_URL = `${APP_URL}/streme-og-ase.png`;
export const APP_SPLASH_URL = `${APP_URL}/android-chrome-512x512.png`;
export const APP_SPLASH_BACKGROUND_COLOR = "#FFFFFF";
export const APP_BUTTON_TEXT = process.env.NEXT_PUBLIC_FRAME_BUTTON_TEXT;
export const APP_WEBHOOK_URL =
  process.env.NEYNAR_API_KEY && process.env.NEYNAR_CLIENT_ID
    ? `https://api.neynar.com/f/app/${process.env.NEYNAR_CLIENT_ID}/event`
    : `${APP_URL}/api/webhook`;

// Verified tokens
export const VERIFIED_TOKENS = [
  "0x3b3cd21242ba44e9865b066e5ef5d1cc1030cc58", // STREME
  "0x1c4f69f14cf754333c302246d25a48a13224118a", // BUTTHOLE
  "0x063eda1b84ceaf79b8cc4a41658b449e8e1f9eeb",
  "0x2800f7bbdd38e84f38ef0a556705a62b5104e91b",
  "0x0358795322c04de04ead2338a803a9d3518a9877", // New verified token
];
