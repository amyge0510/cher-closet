import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { closetTitle, wardrobeTitle } from "./auth/names";
import { useAuth } from "./auth/useAuth";
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

// Sign-in first; once someone has a name, the hanger splash and their closet.
export function App() {
  const { state: auth, sendCode, verifyCode, saveName, signOut, skip } = useAuth();
  const name = auth.status === "signedIn" || auth.status === "guest" ? auth.name : null;

  useEffect(() => {
    document.title = closetTitle(name);
  }, [name]);

  let screen;
  if (auth.status === "loading") screen = null;
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
      />
    );

  return <Stage>{screen}</Stage>;
}

function Closet({ title, signedIn, onSignOut }: { title: string; signedIn: boolean; onSignOut?: () => void }) {
  const [state, dispatch] = useReducer(reducer, initialState);
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
        <Wardrobe state={state} dispatch={dispatch} closet={closet} categories={categories} title={title} onSignOut={onSignOut} />
      )}
      {DevOverlay && (
        <Suspense fallback={null}>
          <DevOverlay state={state} dispatch={dispatch} verdictReason={state.verdict?.reason} />
        </Suspense>
      )}
    </>
  );
}
