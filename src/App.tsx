import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { closetTitle, wardrobeTitle } from "./auth/names";
import { introSeenOf, looksOf, styleOf, useAuth, wardrobeOf } from "./auth/useAuth";
import type { Look } from "./closet/types";
import type { MyStyle, Wardrobe as WardrobeChoice } from "./style/styles";
import { categoriesFor } from "./closet/categories";
import { demoCloset } from "./closet/demoArt";
import { deleteGarment, loadCloset, saveGarment, saveStyles } from "./closet/repo";
import { categoriesFor as categoriesOf } from "./closet/categories";
import { loadImage, makeCanvas } from "./pixel/raster";
import { jpegOf } from "./upload/gemini";
import { retagStyles, tagCategories } from "./upload/tags";
import { clearBody, loadBody, saveBody, type Body } from "./closet/bodyPhoto";
import type { BodyAnchors } from "./closet/body";
import type { Garment } from "./closet/types";
import { Intro } from "./screens/Intro";
import { SignIn } from "./screens/SignIn";
import { Splash } from "./screens/Splash";
import { Wardrobe } from "./screens/Wardrobe";
import { Stage } from "./stage/Stage";
import { initialState, reducer } from "./state/machine";

const DevOverlay = import.meta.env.DEV ? lazy(() => import("./dev/DevOverlay").then((m) => ({ default: m.DevOverlay }))) : null;

// Visiting with ?preview=signin shows the sign-in screens even when signed in.
// Nothing is sent or saved: every step just succeeds after a short pause.
const PREVIEW = new URLSearchParams(window.location.search).get("preview");
const PREVIEW_SIGNIN = PREVIEW === "signin";
// ?preview=intro replays the welcome intro even if it has been seen
const PREVIEW_INTRO = PREVIEW === "intro";

// `onDone` runs after the last step.
function SignInPreview({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<"phone" | "name" | "wardrobe">("phone");
  const pause = () => new Promise<void>((done) => setTimeout(done, 600));
  return (
    <SignIn
      preview
      needsName={step === "name"}
      needsWardrobe={step === "wardrobe"}
      sendCode={pause}
      verifyCode={async () => {
        await pause();
        setStep("name");
      }}
      saveName={async () => {
        await pause();
        setStep("wardrobe");
      }}
      saveWardrobe={async () => {
        await pause();
        onDone();
      }}
    />
  );
}

// Sign-in first; once someone has a name, the hanger splash and their closet.
export function App() {
  const { state: auth, sendCode, verifyCode, saveName, saveWardrobe, saveStyle, saveLooks, markIntroSeen, signOut, skip } = useAuth();
  const name = auth.status === "signedIn" || auth.status === "guest" ? auth.name : null;
  // womenswear / menswear / both: asked once, right after the name
  const [guestWardrobe, setGuestWardrobe] = useState(() => loadGuest<WardrobeChoice>(GUEST_WARDROBE_KEY));
  const wardrobe = auth.status === "signedIn" ? wardrobeOf(auth.user) : guestWardrobe;
  const saveGuestWardrobe = useCallback(async (w: WardrobeChoice) => {
    setGuestWardrobe(w);
    saveGuest(GUEST_WARDROBE_KEY, w);
  }, []);
  // the welcome intro plays once per account, right after first sign-in
  const [introDone, setIntroDone] = useState(false);
  // ?preview=intro walks through a pretend sign-in first, like a new user
  const [previewSignedIn, setPreviewSignedIn] = useState(false);
  const [justChoseWardrobe, setJustChoseWardrobe] = useState(false);
  const introSeen = auth.status === "signedIn" ? introSeenOf(auth.user) : loadGuest<boolean>(GUEST_INTRO_KEY) === true;
  const finishIntro = useCallback(() => {
    setIntroDone(true);
    if (auth.status === "signedIn") markIntroSeen().catch(() => {});
    else saveGuest(GUEST_INTRO_KEY, true);
  }, [auth.status, markIntroSeen]);

  useEffect(() => {
    document.title = closetTitle(name);
  }, [name]);

  let screen;
  // both previews run the first-sign-in order: sign-in, wardrobe question, intro
  if ((PREVIEW_SIGNIN || PREVIEW_INTRO) && !previewSignedIn) screen = <SignInPreview onDone={() => setPreviewSignedIn(true)} />;
  else if (PREVIEW_SIGNIN && !introDone) screen = <Intro onDone={() => (window.location.search = "")} />;
  else if (PREVIEW_INTRO && !introDone) screen = <Intro onDone={() => setIntroDone(true)} />;
  else if (auth.status === "loading") screen = null;
  else if (auth.status === "signedOut" || (auth.status === "signedIn" && !auth.name) || !wardrobe)
    screen = (
      <SignIn
        needsName={auth.status === "signedIn" && !auth.name}
        needsWardrobe={auth.status !== "signedOut" && !wardrobe}
        savedName={name}
        sendCode={sendCode}
        verifyCode={verifyCode}
        saveName={saveName}
        saveWardrobe={async (w) => {
          await (auth.status === "signedIn" ? saveWardrobe : saveGuestWardrobe)(w);
          setJustChoseWardrobe(true);
        }}
        onSkip={import.meta.env.DEV ? skip : undefined}
      />
    );
  // the movie scene follows the wardrobe question, even for accounts that
  // saw it before the question existed
  else if (!introDone && (!introSeen || justChoseWardrobe)) screen = <Intro onDone={finishIntro} />;
  else
    screen = (
      <Closet
        key={auth.status === "signedIn" ? auth.user.id : "guest"}
        title={wardrobeTitle(name)}
        signedIn={auth.status === "signedIn"}
        onSignOut={auth.status === "signedIn" ? signOut : undefined}
        savedStyle={auth.status === "signedIn" ? styleOf(auth.user) : loadGuestStyle()}
        persistStyle={auth.status === "signedIn" ? saveStyle : saveGuestStyle}
        savedLooks={auth.status === "signedIn" ? looksOf(auth.user) : loadGuest<Look[]>(GUEST_LOOKS_KEY) ?? []}
        persistLooks={auth.status === "signedIn" ? saveLooks : (l) => saveGuest(GUEST_LOOKS_KEY, l)}
        afterIntro={introDone}
        wardrobe={wardrobe ?? "both"}
        persistWardrobe={auth.status === "signedIn" ? saveWardrobe : saveGuestWardrobe}
        userId={auth.status === "signedIn" ? auth.user.id : null}
      />
    );

  return <Stage>{screen}</Stage>;
}

// Guests (local dev, no backend) keep their style and looks in this browser only.
const GUEST_STYLE_KEY = "cher-guest-style";
const GUEST_LOOKS_KEY = "cher-guest-looks";
const GUEST_INTRO_KEY = "cher-guest-intro-seen";
const GUEST_WARDROBE_KEY = "cher-guest-wardrobe";
function loadGuest<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
async function saveGuest(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: it lasts until reload */
  }
}
const loadGuestStyle = () => loadGuest<MyStyle>(GUEST_STYLE_KEY);
const saveGuestStyle = (style: MyStyle) => saveGuest(GUEST_STYLE_KEY, style);

function Closet({ title, signedIn, onSignOut, savedStyle, persistStyle, savedLooks, persistLooks, afterIntro, wardrobe: savedWardrobe, persistWardrobe, userId }: {
  title: string;
  signedIn: boolean;
  onSignOut?: () => void;
  savedStyle: MyStyle | null;
  persistStyle: (s: MyStyle) => Promise<void>;
  savedLooks: Look[];
  persistLooks: (l: Look[]) => Promise<void>;
  /** just came out of the intro: the hangers start under its pink smoke */
  afterIntro: boolean;
  wardrobe: WardrobeChoice;
  persistWardrobe: (w: WardrobeChoice) => Promise<void>;
  /** where uploads are saved; null keeps them in this tab only */
  userId: string | null;
}) {
  const [wardrobe, setWardrobe] = useState(savedWardrobe);
  const changeWardrobe = useCallback(
    (w: WardrobeChoice) => {
      setWardrobe(w);
      persistWardrobe(w).catch(() => {});
    },
    [persistWardrobe],
  );
  const [looks, setLooks] = useState(savedLooks);
  const saveMyLooks = useCallback(
    (l: Look[]) => {
      setLooks(l);
      persistLooks(l).catch(() => {});
    },
    [persistLooks],
  );
  const [state, dispatch] = useReducer(reducer, initialState);
  const [myStyle, setMyStyle] = useState(savedStyle);
  const saveMyStyle = useCallback(
    (s: MyStyle) => {
      setMyStyle(s);
      persistStyle(s).catch(() => {});
    },
    [persistStyle],
  );
  const [own, setOwn] = useState<Garment[]>([]);
  // the user's own clothes have arrived (or there are none to wait for)
  const [closetReady, setClosetReady] = useState(!signedIn);
  useEffect(() => {
    if (signedIn)
      loadCloset()
        .then(setOwn, () => setOwn([]))
        .finally(() => setClosetReady(true));
  }, [signedIn]);
  // Until someone has uploaded at least one top and one bottom of their own,
  // the demo rack (for their wardrobe choice) keeps the machine usable, with
  // their uploads mixed in.
  const closet = useMemo(() => {
    const complete = own.some((g) => g.slot === "top") && own.some((g) => g.slot === "bottom");
    return complete ? own : [...demoCloset(wardrobe), ...own];
  }, [own, wardrobe]);
  const [notice, setNotice] = useState<string | null>(null);
  // RE-TAG MY CLOSET: the AI reads the styles of every uploaded piece again
  // (names and categories stay as they are)
  const retagCloset = useCallback(async () => {
    const mine = own;
    if (!mine.length) return setNotice("NOTHING UPLOADED YET TO RE-TAG.");
    setNotice(`RE-TAGGING ${mine.length} ${mine.length === 1 ? "PIECE" : "PIECES"}...`);
    const cats = tagCategories(categoriesOf(mine));
    let done = 0;
    for (const g of mine) {
      try {
        const img = await loadImage(g.image);
        const c = makeCanvas(img.width, img.height);
        c.getContext("2d")!.drawImage(img, 0, 0);
        const styles = await retagStyles(jpegOf(c, 512), g.category, cats, wardrobe);
        if (!styles) continue;
        setOwn((o) => o.map((x) => (x.id === g.id ? { ...x, styles } : x)));
        await saveStyles(g.id, styles);
        done++;
      } catch (e) {
        console.warn("couldn't re-tag", g.name, e);
      }
    }
    setNotice(done ? `RE-TAGGED ${done} ${done === 1 ? "PIECE" : "PIECES"}. TRY MY STYLE AGAIN.` : "COULDN'T RE-TAG. SIGN IN AND TRY AGAIN.");
  }, [own, wardrobe]);
  const removeGarment = useCallback(
    (g: Garment) => {
      setOwn((o) => o.filter((x) => x.id !== g.id));
      if (userId)
        deleteGarment(userId, g.id).catch((e) => {
          console.error("could not delete:", e);
          setNotice("COULDN'T DELETE THAT FROM YOUR ACCOUNT. TRY AGAIN LATER.");
        });
    },
    [userId],
  );
  // MY MODEL PHOTO: the user's own figure for the reveal
  const [body, setBody] = useState<Body | null>(null);
  useEffect(() => {
    if (signedIn) loadBody().then(setBody, () => setBody(null));
  }, [signedIn]);
  const applyBody = useCallback(
    (canvas: HTMLCanvasElement, anchors: BodyAnchors) => {
      setBody({ src: canvas.toDataURL("image/png"), anchors });
      if (userId)
        saveBody(userId, canvas, anchors).catch((e) => {
          console.error("could not save the model photo:", e);
          setNotice("COULDN'T SAVE YOUR MODEL PHOTO. IT'S HERE UNTIL YOU LEAVE.");
        });
    },
    [userId],
  );
  const resetBody = useCallback(() => {
    setBody(null);
    clearBody().catch(() => {});
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);
  const uploaded = useCallback(
    (g: Garment, png: Blob) => {
      setOwn((o) => [...o, g]);
      if (userId)
        saveGarment(userId, g, png).catch((e) => {
          console.error("could not save the upload:", e);
          setNotice("COULDN'T SAVE THAT TO YOUR ACCOUNT. IT'S HERE UNTIL YOU LEAVE.");
        });
    },
    [userId],
  );
  const categories = useMemo(() => categoriesFor(closet), [closet]);
  const splashDone = useCallback(() => dispatch({ type: "SPLASH_DONE" }), []);

  return (
    <>
      {state.screen === "splash" ? (
        <Splash onDone={splashDone} smokeIn={afterIntro} />
      ) : (
        <Wardrobe state={state} dispatch={dispatch} closet={closet} categories={categories} title={title} onSignOut={onSignOut} myStyle={myStyle} onSaveStyle={saveMyStyle} looks={looks} onSaveLooks={saveMyLooks} wardrobe={wardrobe} onChangeWardrobe={changeWardrobe} onUploaded={uploaded} onDeleteGarment={removeGarment} onRetag={signedIn ? retagCloset : undefined} notice={notice} body={body} canRedraw={signedIn} onBody={applyBody} onResetBody={resetBody} closetReady={closetReady} outfitKey={`cher-last-outfit-${userId ?? "guest"}`} />
      )}
      {DevOverlay && (
        <Suspense fallback={null}>
          <DevOverlay state={state} dispatch={dispatch} verdictReason={state.verdict?.reason} />
        </Suspense>
      )}
    </>
  );
}
