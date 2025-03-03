export const FRAME_METADATA = {
  version: "next",
  imageUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/og.png`,
  button: {
    title: "Launch Frame",
    action: {
      type: "launch_frame",
      name: "Launch Frame",
      url: process.env.NEXT_PUBLIC_BASE_URL,
      splashImageUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/splash.png`,
      splashBackgroundColor: "#f7f7f7",
    },
  },
};
