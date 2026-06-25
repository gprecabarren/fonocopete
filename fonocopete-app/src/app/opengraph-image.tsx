import { ImageResponse } from "next/og";

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
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#171717",
          color: "#ffffff",
          padding: "72px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", color: "#fbbf24", fontSize: 32, fontWeight: 700 }}>
          BOTILLERÍA Y DELIVERY
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 82, fontWeight: 900, lineHeight: 1 }}>
            Fonocopete
          </div>
          <div style={{ display: "flex", color: "#ef4444", fontSize: 64, fontWeight: 900 }}>
            Concepción
          </div>
          <div style={{ display: "flex", marginTop: 30, fontSize: 30, color: "#d4d4d4" }}>
            Catálogo online y pedidos directos por WhatsApp
          </div>
        </div>
      </div>
    ),
    size,
  );
}
