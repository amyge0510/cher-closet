import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { C } from "../stage/palette";
import type { Box } from "../stage/layout";
import { PixelText } from "./PixelText";

type Props = {
  box: Box;
  value: string;
  onChange: (v: string) => void;
  /** keeps only allowed characters */
  filter?: (v: string) => string;
  placeholder?: string;
  maxLength?: number;
  inputMode?: "text" | "tel" | "numeric" | "search";
  autoComplete?: string;
  autoFocus?: boolean;
  label: string;
  onEnter?: () => void;
  sx?: number;
  sy?: number;
  style?: CSSProperties;
};

// A text box drawn in the bitmap font. A real (invisible) input sits on top so
// typing, pasting, autofill and phone keyboards all work normally; the text is
// always edited at the end, like an old terminal.
export function PixelField({ box, value, onChange, filter = (v) => v, placeholder, maxLength, inputMode = "text", autoComplete, autoFocus, label, onEnter, sx = 2, sy = 2.4, style }: Props) {
  const [focused, setFocused] = useState(false);
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onEnter?.();
  };
  const showPlaceholder = !value && placeholder && !focused;
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        boxSizing: "border-box",
        background: C.white,
        border: "3px solid",
        borderColor: `${C.btnGrayDark} ${C.btnGrayLight} ${C.btnGrayLight} ${C.btnGrayDark}`,
        display: "flex",
        alignItems: "center",
        gap: sx,
        padding: `0 ${sx * 3}px`,
        overflow: "hidden",
        ...style,
      }}
    >
      {value && <PixelText text={value} color={C.ink} sx={sx} sy={sy} />}
      {showPlaceholder && <PixelText text={placeholder} color={C.btnGray} sx={sx} sy={sy} />}
      {focused && <div className="cursor" style={{ width: sx * 4, height: sy * 7, background: C.ink }} />}
      <input
        aria-label={label}
        value={value}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        spellCheck={false}
        onChange={(e) => onChange(filter(e.target.value))}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0,
          fontSize: 16, // stops phones from zooming in on focus
          width: "100%",
          height: "100%",
          border: 0,
          padding: 0,
          cursor: "text",
        }}
      />
    </div>
  );
}
