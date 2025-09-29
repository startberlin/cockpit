/** biome-ignore-all lint/performance/noImgElement: <explanation> */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

async function loadLocalFont(fontPath: string) {
  try {
    const fontData = await readFile(join(process.cwd(), "public", fontPath));
    return fontData;
  } catch (error) {
    throw new Error(`Failed to load font from ${fontPath}: ${error}`);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") || "START Berlin Cockpit";
  const subtitle =
    searchParams.get("subtitle") ||
    "Manage your membership, get access to software and more.";

  // Create absolute URL for the logo
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000";
  const logoUrl = `${baseUrl}/logo-white.png`;
  const polygonUrl = `${baseUrl}/polygon.png`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        alignItems: "flex-start",
        padding: "60px 45px",
        position: "relative",
        background: "#00002B",
      }}
    >
      <div
        tw="text-white text-[65px] font-bold mb-[30px] uppercase"
        style={{ fontFamily: "Avenir Next Bold" }}
      >
        {title}
      </div>
      <div
        tw="text-[30px] font-normal max-w-4xl uppercase"
        style={{ fontFamily: "Avenir Next Bold", color: "#03C3DD" }}
      >
        {subtitle}
      </div>
      <div tw="absolute bottom-[50px] left-[45px] flex items-center">
        <img
          src={logoUrl}
          alt="START Berlin"
          width="157"
          height="72"
          tw="object-contain"
        />
      </div>
      <div tw="absolute bottom-0 right-0 flex items-center">
        <img
          src={polygonUrl}
          alt=""
          width="266"
          height="266"
          tw="object-contain"
        />
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Avenir Next Bold",
          data: await loadLocalFont("avenirnext-bold.otf"),
          style: "normal",
        },
      ],
    },
  );
}
