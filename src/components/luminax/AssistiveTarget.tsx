import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { useLumina } from "@/app/LuminaProvider";
import { cn } from "@/lib/utils";

type AssistiveTargetProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  targetId: string;
  label: string;
  dwellMs?: number;
  requiresConfirmation?: boolean;
  priority?: number;
  attractionStrength?: number;
  allowWhenPaused?: boolean;
  tone?: "cyan" | "mint" | "amber" | "violet" | "coral" | "neutral";
  children: ReactNode;
};

export const AssistiveTarget = forwardRef<HTMLButtonElement, AssistiveTargetProps>(
  ({
    targetId,
    label,
    dwellMs,
    requiresConfirmation = false,
    priority = 0,
    attractionStrength = 0.7,
    allowWhenPaused = targetId === "system-pause",
    tone = "neutral",
    className,
    disabled,
    children,
    ...props
  }, forwardedRef) => {
    const { registerTarget, preferences } = useLumina();
    const localRef = useRef<HTMLButtonElement>(null);
    useImperativeHandle(forwardedRef, () => localRef.current as HTMLButtonElement);

    useLayoutEffect(() => {
      if (!localRef.current) return;
      return registerTarget(localRef.current, {
        id: targetId,
        label,
        durationMs: dwellMs ?? preferences.dwellMs,
        requiresConfirmation,
        disabled: Boolean(disabled),
        priority,
        attractionStrength,
        allowWhenPaused,
      });
    }, [allowWhenPaused, attractionStrength, disabled, dwellMs, label, preferences.dwellMs, priority, registerTarget, requiresConfirmation, targetId]);

    return (
      <button
        ref={localRef}
        type="button"
        data-luminax-target={targetId}
        data-luminax-label={label}
        data-luminax-disabled={disabled ? "true" : "false"}
        data-dwell-ms={dwellMs}
        aria-label={label}
        disabled={disabled}
        className={cn("assistive-target", `assistive-target--${tone}`, className)}
        {...props}
      >
        {children}
        <span className="assistive-target__signal" aria-hidden="true" />
      </button>
    );
  },
);

AssistiveTarget.displayName = "AssistiveTarget";
