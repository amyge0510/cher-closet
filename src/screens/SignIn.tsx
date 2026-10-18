import { useEffect, useState } from "react";
import { cleanName, keepDigits, keepPhoneChars, toE164, wardrobeTitle } from "../auth/names";
import { friendlyError } from "../auth/useAuth";
import { BUILT_IN } from "../closet/categories";
import { WARDROBES, type Wardrobe } from "../style/styles";
import { PixelField } from "../pixel/PixelField";
import { PixelLines, PixelText } from "../pixel/PixelText";
import { C } from "../stage/palette";
import { L } from "../stage/layout";
import { Bevel, ButtonLabel, CategoryBar, Header, Leopard, pos } from "./Parts";

type Step = "phone" | "code" | "name" | "wardrobe";

const COPY: Record<Step, { title: string; label: string; button: string[] }> = {
  phone: { title: "WHO'S GETTING DRESSED?", label: "PHONE NUMBER", button: ["TEXT", "ME"] },
  code: { title: "CHECK YOUR TEXTS", label: "6-DIGIT CODE", button: ["LET ME", "IN"] },
  name: { title: "WHAT'S YOUR NAME?", label: "FIRST NAME", button: ["DONE"] },
  // about the clothes, not the person: anyone can pick any of these
  wardrobe: { title: "WHAT DO YOU LIKE TO WEAR?", label: "", button: ["DONE"] },
};

const WARDROBE_BUTTON = { x: 222, w: 204, h: 32, y: 182, gap: 8 };
const WARDROBE_HINT_Y = 310;
const PHONE_ERROR_Y = 360; // below the longer privacy note

const CODE_LENGTH = 6;

// Sign-in, dressed as the wardrobe screen: phone number, texted code, then a
// first name that goes on the header, then (once) which clothes to suggest.
export function SignIn({ needsName, needsWardrobe = false, sendCode, verifyCode, saveName, saveWardrobe, savedName, onSkip, preview }: {
  needsName: boolean;
  /** first sign-in: ask womenswear / menswear / both after the name */
  needsWardrobe?: boolean;
  saveWardrobe?: (w: Wardrobe) => Promise<void>;
  /** the name already on the account, for the header */
  savedName?: string | null;
  /** the pretend sign-in (?preview=...): says plainly that no text is sent */
  preview?: boolean;
  sendCode: (phone: string) => Promise<void>;
  verifyCode: (phone: string, code: string) => Promise<void>;
  saveName: (name: string) => Promise<void>;
  onSkip?: () => void;
}) {
  const [step, setStep] = useState<Step>(needsName ? "name" : needsWardrobe ? "wardrobe" : "phone");
  const [wardrobe, setWardrobe] = useState<Wardrobe | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (needsName) setStep("name");
    else if (needsWardrobe) setStep("wardrobe");
  }, [needsName, needsWardrobe]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const e164 = toE164(phone);
  const submit = () => {
    if (busy) return;
    if (step === "phone") {
      if (!e164) return setError("TYPE A 10-DIGIT NUMBER, OR START WITH + AND THE COUNTRY CODE.");
      run(async () => {
        await sendCode(e164);
        setCode("");
        setStep("code");
      });
    } else if (step === "code") {
      if (code.length !== CODE_LENGTH) return setError(`THE CODE IS ${CODE_LENGTH} DIGITS.`);
      run(() => verifyCode(e164!, code));
    } else if (step === "name") {
      if (!name.trim()) return setError("WHAT SHOULD WE CALL YOU?");
      run(() => saveName(name));
    } else {
      if (!wardrobe) return setError("PICK ONE. YOU CAN CHANGE IT LATER.");
      run(() => saveWardrobe!(wardrobe));
    }
  };

  // codes submit themselves once all six digits are in
  useEffect(() => {
    if (step === "code" && code.length === CODE_LENGTH) submit();
  }, [code, step]);

  const panel = L.revealPanel;
  const inner = panel.w - 24;
  const copy = COPY[step];
  const hint = step === "wardrobe"
    ? "THIS ONLY PICKS WHICH CLOTHES AND STYLES WE SUGGEST. CHANGE IT ANYTIME UNDER MORE."
    : preview
    ? step === "name"
      ? "PREVIEW ONLY. NOTHING IS SAVED."
      : "PREVIEW ONLY. NO TEXT IS SENT. ANY 6 DIGITS WORK."
    : step === "phone"
      ? "WE'LL TEXT YOU A CODE. YOUR NUMBER IS ONLY USED TO SIGN YOU IN AND KEEP YOUR CLOSET SAVED. NO ADS, NO SPAM, NEVER SOLD."
      : step === "code"
        ? `SENT TO ${e164 ?? phone}. WRONG NUMBER? HIT BACK.`
        : "IT GOES ON YOUR WARDROBE.";
  const centered = (y: number) => ({ position: "absolute" as const, left: panel.x + 12, top: y, width: inner });

  return (
    <div className="fade-in" style={{ position: "absolute", inset: 0, background: C.frameDark }}>
      <Header title={step === "name" ? wardrobeTitle(name) : step === "wardrobe" && savedName ? wardrobeTitle(savedName) : "YOUR WARDROBE"} season={preview ? "PREVIEW" : "SIGN IN"} />
      <Leopard box={L.leopardLeft} />
      <Leopard box={L.leopardRight} />
      <div style={{ ...pos(L.center), background: C.frameDark, borderLeft: `2px solid ${C.frame}`, borderRight: `2px solid ${C.frame}`, boxSizing: "border-box" }} />
      <div style={{ ...pos(panel), background: C.panel }} />

      <div style={centered(L.signTitle.y)}>
        <PixelLines text={copy.title} maxWidth={inner} color={C.ink} sx={L.signTitle.sx} sy={L.signTitle.sy} bold shadow={C.white} gap={0.5} />
      </div>
      {copy.label && (
        <div style={centered(L.signLabel.y)}>
          <PixelLines text={copy.label} maxWidth={inner} color={C.ink} sx={L.signLabel.sx} sy={L.signLabel.sy} />
        </div>
      )}

      {step === "phone" && (
        <PixelField key="phone" box={L.signField} label="Phone number" value={phone} onChange={setPhone} filter={keepPhoneChars}
          placeholder="(213) 555-0123" inputMode="tel" autoComplete="tel" autoFocus onEnter={submit} />
      )}
      {step === "code" && (
        <PixelField key="code" box={L.signField} label="Code from your text" value={code} onChange={setCode}
          filter={(v) => keepDigits(v).slice(0, CODE_LENGTH)} placeholder="______" inputMode="numeric" autoComplete="one-time-code" autoFocus onEnter={submit}
          sx={3} sy={2.6} />
      )}
      {step === "name" && (
        <PixelField key="name" box={L.signField} label="First name" value={name} onChange={setName} filter={cleanName}
          placeholder="CHER" autoComplete="given-name" autoFocus onEnter={submit} />
      )}

      {step === "wardrobe" &&
        WARDROBES.map((w, i) => (
          <Bevel
            key={w.id}
            box={{ x: WARDROBE_BUTTON.x, y: WARDROBE_BUTTON.y + i * (WARDROBE_BUTTON.h + WARDROBE_BUTTON.gap), w: WARDROBE_BUTTON.w, h: WARDROBE_BUTTON.h }}
            tone={wardrobe === w.id ? "blue" : "gray"}
            onClick={() => (setWardrobe(w.id), setError(""))}
            label={w.label}
            style={{ borderWidth: 2 }}
          >
            <PixelText text={w.label} color={wardrobe === w.id ? C.white : C.ink} sx={1.8} sy={2.2} bold />
          </Bevel>
        ))}

      <div style={centered(step === "wardrobe" ? WARDROBE_HINT_Y : L.signHint.y)}>
        <PixelLines text={hint} maxWidth={inner} color={C.frame} sx={L.signHint.sx} sy={L.signHint.sy} />
      </div>
      {error && (
        <div role="alert" style={centered(step === "wardrobe" ? WARDROBE_HINT_Y + 50 : step === "phone" ? PHONE_ERROR_Y : L.signError.y)}>
          <PixelLines text={error} maxWidth={inner} color="#a3123a" sx={L.signError.sx} sy={L.signError.sy} />
        </div>
      )}

      {step === "code" && (
        <Bevel box={L.leftButton} tone="gray" onClick={() => (setStep("phone"), setError(""))} label="Back">
          <ButtonLabel lines={["BACK"]} />
        </Bevel>
      )}
      {step === "phone" && onSkip && (
        <Bevel box={L.leftButton} tone="gray" onClick={onSkip} label="Skip sign-in (dev only)">
          <ButtonLabel lines={["SKIP", "(DEV)"]} />
        </Bevel>
      )}
      <Bevel box={L.rightButton} tone="blue" onClick={submit} label={copy.button.join(" ")} style={{ opacity: busy ? 0.7 : 1 }}>
        <ButtonLabel lines={busy ? ["WAIT"] : copy.button} />
      </Bevel>

      <CategoryBar categories={BUILT_IN} />
    </div>
  );
}
