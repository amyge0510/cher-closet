import { useEffect, useState } from "react";
import { cleanName, keepDigits, keepPhoneChars, toE164, wardrobeTitle } from "../auth/names";
import { friendlyError } from "../auth/useAuth";
import { BUILT_IN } from "../closet/categories";
import { PixelField } from "../pixel/PixelField";
import { PixelLines } from "../pixel/PixelText";
import { C } from "../stage/palette";
import { L } from "../stage/layout";
import { Bevel, ButtonLabel, CategoryBar, Header, Leopard, pos } from "./Parts";

type Step = "phone" | "code" | "name";

const COPY: Record<Step, { title: string; label: string; button: string[] }> = {
  phone: { title: "WHO'S GETTING DRESSED?", label: "PHONE NUMBER", button: ["TEXT", "ME"] },
  code: { title: "CHECK YOUR TEXTS", label: "6-DIGIT CODE", button: ["LET ME", "IN"] },
  name: { title: "WHAT'S YOUR NAME?", label: "FIRST NAME", button: ["DONE"] },
};

const CODE_LENGTH = 6;

// Sign-in, dressed as the wardrobe screen: phone number, texted code, then a
// first name that goes on the header.
export function SignIn({ needsName, sendCode, verifyCode, saveName, onSkip, preview }: {
  needsName: boolean;
  /** the pretend sign-in (?preview=...): says plainly that no text is sent */
  preview?: boolean;
  sendCode: (phone: string) => Promise<void>;
  verifyCode: (phone: string, code: string) => Promise<void>;
  saveName: (name: string) => Promise<void>;
  onSkip?: () => void;
}) {
  const [step, setStep] = useState<Step>(needsName ? "name" : "phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (needsName) setStep("name");
  }, [needsName]);

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
    } else {
      if (!name.trim()) return setError("WHAT SHOULD WE CALL YOU?");
      run(() => saveName(name));
    }
  };

  // codes submit themselves once all six digits are in
  useEffect(() => {
    if (step === "code" && code.length === CODE_LENGTH) submit();
  }, [code, step]);

  const panel = L.revealPanel;
  const inner = panel.w - 24;
  const copy = COPY[step];
  const hint = preview
    ? step === "name"
      ? "PREVIEW ONLY. NOTHING IS SAVED."
      : "PREVIEW ONLY. NO TEXT IS SENT. ANY 6 DIGITS WORK."
    : step === "phone"
      ? "WE'LL TEXT YOU A CODE. NO PASSWORDS."
      : step === "code"
        ? `SENT TO ${e164 ?? phone}. WRONG NUMBER? HIT BACK.`
        : "IT GOES ON YOUR WARDROBE.";
  const centered = (y: number) => ({ position: "absolute" as const, left: panel.x + 12, top: y, width: inner });

  return (
    <div className="fade-in" style={{ position: "absolute", inset: 0, background: C.frameDark }}>
      <Header title={step === "name" ? wardrobeTitle(name) : "YOUR WARDROBE"} season={preview ? "PREVIEW" : "SIGN IN"} />
      <Leopard box={L.leopardLeft} />
      <Leopard box={L.leopardRight} />
      <div style={{ ...pos(L.center), background: C.frameDark, borderLeft: `2px solid ${C.frame}`, borderRight: `2px solid ${C.frame}`, boxSizing: "border-box" }} />
      <div style={{ ...pos(panel), background: C.panel }} />

      <div style={centered(L.signTitle.y)}>
        <PixelLines text={copy.title} maxWidth={inner} color={C.ink} sx={L.signTitle.sx} sy={L.signTitle.sy} bold shadow={C.white} gap={0.5} />
      </div>
      <div style={centered(L.signLabel.y)}>
        <PixelLines text={copy.label} maxWidth={inner} color={C.ink} sx={L.signLabel.sx} sy={L.signLabel.sy} />
      </div>

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

      <div style={centered(L.signHint.y)}>
        <PixelLines text={hint} maxWidth={inner} color={C.frame} sx={L.signHint.sx} sy={L.signHint.sy} />
      </div>
      {error && (
        <div role="alert" style={centered(L.signError.y)}>
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
