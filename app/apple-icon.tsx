import { ImageResponse } from "next/og";

// Apple Touch Icon (180×180). Gleiches Stacked-Cards-Konzept wie das
// Browser-Tab-Favicon (app/icon.svg), aber mit cream-Background und
// padding damit es sauber als gerundetes App-Icon im iOS-Homescreen
// und Android-Bookmark erscheint. Next.js generiert das aus diesem
// File automatisch und cached den Output.

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "#FBF7F0",
        }}
      >
        <svg
          width="130"
          height="130"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Hintere Karte */}
          <rect
            x="3.5"
            y="7"
            width="19"
            height="22"
            rx="2.5"
            stroke="#2B1F19"
            strokeWidth="1.6"
            fill="#FBF7F0"
            opacity="0.55"
          />
          {/* Vordere Karte */}
          <rect
            x="7"
            y="3"
            width="22"
            height="24"
            rx="3"
            fill="#2B1F19"
          />
          {/* Recipe-Lines */}
          <line
            x1="11"
            y1="13"
            x2="22"
            y2="13"
            stroke="#FBF7F0"
            strokeWidth="1.2"
            opacity="0.55"
            strokeLinecap="round"
          />
          <line
            x1="11"
            y1="17"
            x2="20"
            y2="17"
            stroke="#FBF7F0"
            strokeWidth="1.2"
            opacity="0.55"
            strokeLinecap="round"
          />
          <line
            x1="11"
            y1="21"
            x2="22"
            y2="21"
            stroke="#FBF7F0"
            strokeWidth="1.2"
            opacity="0.55"
            strokeLinecap="round"
          />
          {/* Bookmark Honey */}
          <path
            d="M22 3 L27 3 L27 11.5 L24.5 9.8 L22 11.5 Z"
            fill="#F4C44A"
          />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
