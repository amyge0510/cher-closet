import { C } from "../stage/palette";

// A pixel loading ring: eight square blocks in a circle, fading from bright
// to dim, turning a block at a time while something is on its way.
export function LoadingRing({ size = 32 }: { size?: number }) {
  const block = Math.max(3, Math.round(size / 6));
  const r = size / 2 - block / 2;
  return (
    <div role="status" aria-label="Loading" className="loading-ring" style={{ position: "relative", width: size, height: size }}>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: Math.round(size / 2 + Math.cos(a) * r - block / 2),
              top: Math.round(size / 2 + Math.sin(a) * r - block / 2),
              width: block,
              height: block,
              background: C.navy,
              opacity: 0.2 + (i / 7) * 0.8,
            }}
          />
        );
      })}
    </div>
  );
}
