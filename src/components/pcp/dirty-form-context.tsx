import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type SaveHandler = () => void | Promise<void>;

interface DirtyFormCtx {
  isDirty: boolean;
  setDirty: (v: boolean) => void;
  registerSave: (fn: SaveHandler | null) => void;
  triggerSave: () => Promise<void>;
}

const Ctx = createContext<DirtyFormCtx | null>(null);

export function DirtyFormProvider({ children }: { children: ReactNode }) {
  const [isDirty, setDirty] = useState(false);
  const saveRef = useRef<SaveHandler | null>(null);

  const registerSave = (fn: SaveHandler | null) => { saveRef.current = fn; };
  const triggerSave = async () => {
    if (saveRef.current) await saveRef.current();
  };

  return (
    <Ctx.Provider value={{ isDirty, setDirty, registerSave, triggerSave }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDirtyForm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDirtyForm must be used within DirtyFormProvider");
  return ctx;
}

/**
 * Track form changes relative to a baseline. Marks dirty when JSON differs.
 * Pass a stable baseline (e.g. `selected ?? empty`) and the current form state.
 */
export function useDirtyTracker(form: unknown, baseline: unknown, enabled = true) {
  const { setDirty } = useDirtyForm();
  const baselineJSON = useRef<string>("");
  useEffect(() => {
    baselineJSON.current = JSON.stringify(baseline ?? {});
    setDirty(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(baseline ?? {})]);
  useEffect(() => {
    if (!enabled) return;
    const cur = JSON.stringify(form ?? {});
    setDirty(cur !== baselineJSON.current);
  }, [form, enabled, setDirty]);
  useEffect(() => () => { setDirty(false); }, [setDirty]);
}

/** Register a save handler for the dirty-form prompt. */
export function useRegisterSave(fn: SaveHandler) {
  const { registerSave } = useDirtyForm();
  useEffect(() => {
    registerSave(fn);
    return () => registerSave(null);
  }, [fn, registerSave]);
}
