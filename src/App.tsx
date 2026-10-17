import { lazy, Suspense, useCallback, useMemo, useReducer } from "react";
import { demoCloset } from "./closet/demoArt";
import { Splash } from "./screens/Splash";
import { Wardrobe } from "./screens/Wardrobe";
import { Stage } from "./stage/Stage";
import { initialState, reducer } from "./state/machine";

const DevOverlay = import.meta.env.DEV ? lazy(() => import("./dev/DevOverlay").then((m) => ({ default: m.DevOverlay }))) : null;

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const closet = useMemo(() => demoCloset(), []);
  const tops = useMemo(() => closet.filter((g) => g.slot === "top"), [closet]);
  const bottoms = useMemo(() => closet.filter((g) => g.slot === "bottom"), [closet]);
  const splashDone = useCallback(() => dispatch({ type: "SPLASH_DONE" }), []);

  return (
    <Stage>
      {state.screen === "splash" ? (
        <Splash onDone={splashDone} />
      ) : (
        <Wardrobe state={state} dispatch={dispatch} tops={tops} bottoms={bottoms} />
      )}
      {DevOverlay && (
        <Suspense fallback={null}>
          <DevOverlay state={state} dispatch={dispatch} verdictReason={state.verdict?.reason} />
        </Suspense>
      )}
    </Stage>
  );
}
