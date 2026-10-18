import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { closetTitle, wardrobeTitle } from "./auth/names";
import { introSeenOf, looksOf, styleOf, useAuth } from "./auth/useAuth";
import type { Look } from "./closet/types";
import type { MyStyle } from "./style/styles";
import { categoriesFor } from "./closet/categories";
import { demoCloset } from "./closet/demoArt";
import { loadCloset } from "./closet/repo";
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

// `onDone` runs after the last step; by default it just reloads the app.
function SignInPreview({ onDone = () => (window.location.search = "") }: { onDone?: () => void }) {
  const [named, setNamed] = useState(false);
  const pause = () => new Promise<void>((done) => setTimeout(done, 600));
  return (
    <SignIn
      needsName={named}
      sendCode={pause}
      verifyCode={async () => {
        await pause();
        setNamed(true);
      }}
      saveName={async () => {
        await pause();
        onDone();
      }}
    />
  );
}

// Sign-in first; once someone has a name, the hanger splash and their closet.
export function App() {
  const { state: auth, sendCode, verifyCode, saveName, saveStyle, saveLooks, markIntroSeen, signOut, skip } = useAuth();
  const name = auth.status === "signedIn" || auth.status === "guest" ? auth.name : null;
  // the welcome intro plays once per account, right after first sign-in
  const [introDone, setIntroDone] = useState(false);
  // ?preview=intro walks through a pretend sign-in first, like a new user
  const [previewSignedIn, setPreviewSignedIn] = useState(false);
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
  if (PREVIEW_SIGNIN) screen = <SignInPreview />;
  else if (PREVIEW_INTRO && !previewSignedIn) screen = <SignInPreview onDone={() => setPreviewSignedIn(true)} />;
  else if (PREVIEW_INTRO && !introDone) screen = <Intro onDone={() => setIntroDone(true)} />;
  else if (auth.status === "loading") screen = null;
  else if (auth.status === "signedOut" || (auth.status === "signedIn" && !auth.name))
    screen = (
      <SignIn
        needsName={auth.status === "signedIn"}
        sendCode={sendCode}
        verifyCode={verifyCode}
        saveName={saveName}
        onSkip={import.meta.env.DEV ? skip : undefined}
      />
    );
  else if (!introDone && !introSeen) screen = <Intro onDone={finishIntro} />;
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
      />
    );

  return <Stage>{screen}</Stage>;
}

// Guests (local dev, no backend) keep their style and looks in this browser only.
const GUEST_STYLE_KEY = "cher-guest-style";
const GUEST_LOOKS_KEY = "cher-guest-looks";
const GUEST_INTRO_KEY = "cher-guest-intro-seen";
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

function Closet({ title, signedIn, onSignOut, savedStyle, persistStyle, savedLooks, persistLooks, afterIntro }: {
  title: string;
  signedIn: boolean;
  onSignOut?: () => void;
  savedStyle: MyStyle | null;
  persistStyle: (s: MyStyle) => Promise<void>;
  savedLooks: Look[];
  persistLooks: (l: Look[]) => Promise<void>;
  /** just came out of the intro: the hangers start under its pink smoke */
  afterIntro: boolean;
}) {
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
  useEffect(() => {
    if (signedIn) loadCloset().then(setOwn, () => setOwn([]));
  }, [signedIn]);
  // until someone uploads their own clothes, the demo rack keeps the machine usable
  const closet = useMemo(() => (own.length ? own : demoCloset()), [own]);
  const categories = useMemo(() => categoriesFor(closet), [closet]);
  const splashDone = useCallback(() => dispatch({ type: "SPLASH_DONE" }), []);

  return (
    <>
      {state.screen === "splash" ? (
        <Splash onDone={splashDone} smokeIn={afterIntro} />
      ) : (
        <Wardrobe state={state} dispatch={dispatch} closet={closet} categories={categories} title={title} onSignOut={onSignOut} myStyle={myStyle} onSaveStyle={saveMyStyle} looks={looks} onSaveLooks={saveMyLooks} />
      )}
      {DevOverlay && (
        <Suspense fallback={null}>
          <DevOverlay state={state} dispatch={dispatch} verdictReason={state.verdict?.reason} />
        </Suspense>
      )}
    </>
  );
}
