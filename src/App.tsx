import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { closetTitle, wardrobeTitle } from "./auth/names";
import { styleOf, useAuth } from "./auth/useAuth";
import type { MyStyle } from "./style/styles";
import { categoriesFor } from "./closet/categories";
import { demoCloset } from "./closet/demoArt";
import { loadCloset } from "./closet/repo";
import type { Garment } from "./closet/types";
import { SignIn } from "./screens/SignIn";
import { Splash } from "./screens/Splash";
import { Wardrobe } from "./screens/Wardrobe";
import { Stage } from "./stage/Stage";
import { initialState, reducer } from "./state/machine";

const DevOverlay = import.meta.env.DEV ? lazy(() => import("./dev/DevOverlay").then((m) => ({ default: m.DevOverlay }))) : null;

// Visiting with ?preview=signin shows the sign-in screens even when signed in.
// Nothing is sent or saved: every step just succeeds after a short pause.
const PREVIEW_SIGNIN = new URLSearchParams(window.location.search).get("preview") === "signin";

function SignInPreview() {
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
        window.location.search = "";
      }}
    />
  );
}

// Sign-in first; once someone has a name, the hanger splash and their closet.
export function App() {
  const { state: auth, sendCode, verifyCode, saveName, saveStyle, signOut, skip } = useAuth();
  const name = auth.status === "signedIn" || auth.status === "guest" ? auth.name : null;

  useEffect(() => {
    document.title = closetTitle(name);
  }, [name]);

  let screen;
  if (PREVIEW_SIGNIN) screen = <SignInPreview />;
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
  else
    screen = (
      <Closet
        key={auth.status === "signedIn" ? auth.user.id : "guest"}
        title={wardrobeTitle(name)}
        signedIn={auth.status === "signedIn"}
        onSignOut={auth.status === "signedIn" ? signOut : undefined}
        savedStyle={auth.status === "signedIn" ? styleOf(auth.user) : loadGuestStyle()}
        persistStyle={auth.status === "signedIn" ? saveStyle : saveGuestStyle}
      />
    );

  return <Stage>{screen}</Stage>;
}

// Guests (local dev, no backend) keep their style in this browser only.
const GUEST_STYLE_KEY = "cher-guest-style";
function loadGuestStyle(): MyStyle | null {
  try {
    return JSON.parse(localStorage.getItem(GUEST_STYLE_KEY) ?? "null");
  } catch {
    return null;
  }
}
async function saveGuestStyle(style: MyStyle) {
  try {
    localStorage.setItem(GUEST_STYLE_KEY, JSON.stringify(style));
  } catch {
    /* storage unavailable: the style lasts until reload */
  }
}

function Closet({ title, signedIn, onSignOut, savedStyle, persistStyle }: {
  title: string;
  signedIn: boolean;
  onSignOut?: () => void;
  savedStyle: MyStyle | null;
  persistStyle: (s: MyStyle) => Promise<void>;
}) {
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
        <Splash onDone={splashDone} />
      ) : (
        <Wardrobe state={state} dispatch={dispatch} closet={closet} categories={categories} title={title} onSignOut={onSignOut} myStyle={myStyle} onSaveStyle={saveMyStyle} />
      )}
      {DevOverlay && (
        <Suspense fallback={null}>
          <DevOverlay state={state} dispatch={dispatch} verdictReason={state.verdict?.reason} />
        </Suspense>
      )}
    </>
  );
}
