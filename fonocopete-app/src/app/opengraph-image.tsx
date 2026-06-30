import { ImageResponse } from "next/og";
import { siteUrl } from "@/lib/site";

export const alt = "Fonocopete Concepción, botillería y delivery";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f4ef",
          color: "#111111",
          padding: "64px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "56px",
            border: "6px solid #111111",
            borderRadius: "36px",
            background: "#ffffff",
            padding: "56px",
          }}
        >
          <img
            src={`${siteUrl}/fonocopete-logo-circle.jpg`}
            alt=""
            width="330"
            height="330"
            style={{
              width: "330px",
              height: "330px",
              borderRadius: "999px",
              objectFit: "cover",
              border: "6px solid #e5e5e5",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", maxWidth: "610px" }}>
            <div style={{ display: "flex", fontSize: 78, fontWeight: 900, lineHeight: 1 }}>
              Fonocopete
            </div>
            <div style={{ display: "flex", color: "#dc2626", fontSize: 54, fontWeight: 900, marginTop: "8px" }}>
              Concepción
            </div>
            <div
              style={{
                display: "flex",
                marginTop: "26px",
                color: "#dc2626",
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: "8px",
              }}
            >
              BOTILLERÍA DELIVERY
            </div>
            <div style={{ display: "flex", marginTop: "22px", fontSize: 25, color: "#404040", lineHeight: 1.35 }}>
              Catálogo online y pedidos directos por WhatsApp
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
