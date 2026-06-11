import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type Ctx = {
  setDirty: (dirty: boolean, onSave?: () => Promise<void> | void) => void;
  /** Roda a ação se não houver alterações pendentes; caso contrário, abre o diálogo. */
  guard: (action: () => void) => void;
};

const UnsavedCtx = createContext<Ctx | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const dirtyRef = useRef(false);
  const saveRef = useRef<(() => Promise<void> | void) | null>(null);
  const [pending, setPending] = useState<null | (() => void)>(null);
  const [open, setOpen] = useState(false);

  const setDirty = useCallback((dirty: boolean, onSave?: () => Promise<void> | void) => {
    dirtyRef.current = dirty;
    if (onSave) saveRef.current = onSave;
    if (!dirty) saveRef.current = null;
  }, []);

  const guard = useCallback((action: () => void) => {
    if (!dirtyRef.current) { action(); return; }
    setPending(() => action);
    setOpen(true);
  }, []);

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return (
    <UnsavedCtx.Provider value={{ setDirty, guard }}>
      {children}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja sair?</AlertDialogTitle>
            <AlertDialogDescription>
              Você fez alterações que ainda não foram salvas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                dirtyRef.current = false;
                saveRef.current = null;
                setOpen(false);
                pending?.();
                setPending(null);
              }}
            >
              Não salvar
            </Button>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              onClick={async () => {
                if (saveRef.current) await saveRef.current();
                dirtyRef.current = false;
                saveRef.current = null;
                setOpen(false);
                pending?.();
                setPending(null);
              }}
            >
              Salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedCtx.Provider>
  );
}

export function useUnsavedChanges() {
  const ctx = useContext(UnsavedCtx);
  if (!ctx) throw new Error("UnsavedChangesProvider ausente");
  return ctx;
}
