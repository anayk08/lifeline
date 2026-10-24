// One-time notice before anything personal is sent to the AI and map services. Features call
// `ensure(onAccept, onDecline)`; it runs right away once the person has agreed (Settings can
// turn it back off), otherwise it opens the notice first.
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import DataNoticeDialog from "../components/DataNoticeDialog";
import { useApp } from "./app";

interface Pending {
  onAccept: () => void;
  onDecline?: () => void;
}

const Ctx = createContext<((onAccept: () => void, onDecline?: () => void) => void) | null>(null);

export function DataNoticeProvider({ children }: { children: ReactNode }) {
  const { settings, update } = useApp();
  const [pending, setPending] = useState<Pending | null>(null);

  const ensure = useCallback(
    (onAccept: () => void, onDecline?: () => void) => {
      if (settings.dataNotice) onAccept();
      else setPending({ onAccept, onDecline });
    },
    [settings.dataNotice],
  );

  return (
    <Ctx.Provider value={ensure}>
      {children}
      {pending && (
        <DataNoticeDialog
          onContinue={() => {
            update({ dataNotice: true });
            setPending(null);
            pending.onAccept();
          }}
          onNotNow={() => {
            setPending(null);
            pending.onDecline?.();
          }}
        />
      )}
    </Ctx.Provider>
  );
}

export function useDataNotice() {
  const ensure = useContext(Ctx);
  if (!ensure) throw new Error("useDataNotice outside DataNoticeProvider");
  return ensure;
}
