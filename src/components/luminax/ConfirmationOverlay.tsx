import { ShieldCheck, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLumina } from "@/app/LuminaProvider";
import { AssistiveTarget } from "./AssistiveTarget";

export function ConfirmationOverlay() {
  const { confirmation, cancelConfirmation, confirmAction } = useLumina();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!confirmation) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    headingRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled)") ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [confirmation]);

  if (!confirmation) return null;

  return (
    <div className="confirmation-overlay" role="presentation">
      <section ref={dialogRef} className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-description">
        <button type="button" className="confirmation-dialog__close" onClick={cancelConfirmation} aria-label="Cancel and close">
          <X aria-hidden="true" />
        </button>
        <div className="confirmation-dialog__icon"><ShieldCheck aria-hidden="true" /></div>
        <p>DELIBERATE CONFIRMATION</p>
        <h2 id="confirmation-title" tabIndex={-1} ref={headingRef}>{confirmation.title}</h2>
        <div id="confirmation-description">{confirmation.description}</div>
        <div className="confirmation-dialog__actions">
          <AssistiveTarget targetId="confirmation-cancel" label="Cancel action" onClick={cancelConfirmation} tone="neutral" dwellMs={1100}>
            Cancel
          </AssistiveTarget>
          <AssistiveTarget targetId="confirmation-accept" label={confirmation.confirmLabel ?? "Hold to confirm"} onClick={confirmAction} tone="mint" dwellMs={1800}>
            <ShieldCheck aria-hidden="true" />
            {confirmation.confirmLabel ?? "Hold to confirm"}
          </AssistiveTarget>
        </div>
      </section>
    </div>
  );
}
