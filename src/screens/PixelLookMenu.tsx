import type { CSSProperties, ReactNode } from "react";
import { EYE_COLORS, HAIR_COLORS, HAIR_STYLES, SKIN_TONES, type PixelLook } from "../closet/pixelModel";
import { PixelText } from "../pixel/PixelText";
import { C } from "../stage/palette";
import { L } from "../stage/layout";

// MY PIXEL MODEL: girl or guy, hairstyle, hair color, eyes and skin for the
// pixel model. Every change shows on her straight away.

const bevel = (on: boolean): CSSProperties => ({
  boxSizing: "border-box",
  border: "2px solid",
  borderColor: on ? `${C.btnBlueLight} ${C.btnBlueDark} ${C.btnBlueDark} ${C.btnBlueLight}` : `${C.btnGrayLight} ${C.btnGrayDark} ${C.btnGrayDark} ${C.btnGrayLight}`,
  background: on ? C.btnBlue : C.btnGray,
  cursor: "pointer",
  padding: "4px 6px",
  display: "grid",
  placeItems: "center",
});

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 5 }}>
      <PixelText text={label} color={C.invText} sx={1.3} sy={1.6} bold />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{children}</div>
    </div>
  );
}

function Swatches({ label, colors, value, onPick }: { label: string; colors: { label: string; hex: string }[]; value: string; onPick: (hex: string) => void }) {
  return (
    <Row label={label}>
      {colors.map((c) => (
        <button
          key={c.hex}
          type="button"
          aria-label={`${label.toLowerCase()}: ${c.label}`}
          aria-pressed={value === c.hex}
          title={c.label}
          onClick={() => onPick(c.hex)}
          style={{ width: 24, height: 24, padding: 0, cursor: "pointer", background: c.hex, border: `2px solid ${C.invEdge}`, boxShadow: value === c.hex ? `0 0 0 2px ${C.white}, 0 0 0 4px ${C.btnBlue}` : "none", margin: 2 }}
        />
      ))}
    </Row>
  );
}

export function PixelLookMenu({ look, onChange, onClose }: { look: PixelLook; onChange: (l: PixelLook) => void; onClose: () => void }) {
  const box = L.pixelLookBox;
  const set = (patch: Partial<PixelLook>) => onChange({ ...look, ...patch });
  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 20 }} />
      <div
        role="dialog"
        aria-label="My pixel model"
        style={{
          position: "absolute",
          left: box.x,
          top: box.y,
          width: box.w,
          height: box.h,
          boxSizing: "border-box",
          padding: 10,
          overflow: "auto",
          background: C.invBg,
          border: `3px solid ${C.invEdge}`,
          boxShadow: `inset 3px 3px 0 ${C.white}, inset -3px -3px 0 ${C.invSlotShadow}`,
          zIndex: 21,
          display: "grid",
          alignContent: "start",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <PixelText text="MY PIXEL MODEL" color={C.invText} sx={1.6} sy={2} bold />
          <button type="button" aria-label="Close" onClick={onClose} style={{ ...bevel(false), width: 26, height: 26, padding: 0 }}>
            <PixelText text="X" color={C.ink} sx={1.8} sy={1.8} />
          </button>
        </div>
        <Row label="MODEL">
          {(["womens", "mens"] as const).map((f) => (
            <button key={f} type="button" aria-pressed={look.figure === f} onClick={() => set({ figure: f })} style={bevel(look.figure === f)}>
              <PixelText text={f === "womens" ? "GIRL" : "GUY"} color={look.figure === f ? C.white : C.ink} sx={1.4} sy={1.7} bold />
            </button>
          ))}
        </Row>
        <Row label="HAIR">
          {HAIR_STYLES.map((h) => (
            <button key={h.id} type="button" aria-pressed={look.hair === h.id} onClick={() => set({ hair: h.id })} style={bevel(look.hair === h.id)}>
              <PixelText text={h.label} color={look.hair === h.id ? C.white : C.ink} sx={1.1} sy={1.4} bold />
            </button>
          ))}
        </Row>
        <Swatches label="HAIR COLOR" colors={HAIR_COLORS} value={look.hairColor} onPick={(hairColor) => set({ hairColor })} />
        <Swatches label="EYES" colors={EYE_COLORS} value={look.eyes} onPick={(eyes) => set({ eyes })} />
        <Swatches label="SKIN" colors={SKIN_TONES} value={look.skin} onPick={(skin) => set({ skin })} />
      </div>
    </>
  );
}
