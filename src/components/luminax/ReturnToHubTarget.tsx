import { House } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AssistiveTarget } from "@/components/luminax/AssistiveTarget";
import { cn } from "@/lib/utils";

export function ReturnToHubTarget({ className }: { className?: string }) {
  const navigate = useNavigate();

  return (
    <AssistiveTarget
      targetId="return-to-access-hub"
      label="Return to Access Hub"
      tone="cyan"
      className={cn("return-to-hub-target", className)}
      dwellMs={900}
      priority={3}
      attractionStrength={0.86}
      onClick={() => navigate("/hub")}
    >
      <House aria-hidden="true" />
      <span>Return to Hub</span>
    </AssistiveTarget>
  );
}
