import { BookOpen, CircleUserRound, MessageSquareText, PlaySquare, Settings2 } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useLumina } from "@/app/LuminaProvider";
import { BrandMark } from "./BrandMark";
import { CameraPreview } from "./CameraPreview";
import { ConfirmationOverlay } from "./ConfirmationOverlay";
import { PresenterPanel } from "./PresenterPanel";
import { ReturnToHubTarget } from "./ReturnToHubTarget";
import { StatusHUD } from "./StatusHUD";
import { GuardianDock } from "@/components/guardian/GuardianDock";

const navItems = [
  { to: "/hub", label: "Access Hub", icon: CircleUserRound },
  { to: "/read", label: "Read", icon: BookOpen },
  { to: "/media", label: "Watch & Listen", icon: PlaySquare },
  { to: "/communicate", label: "Communicate", icon: MessageSquareText },
];

export function LuminaShell() {
  const { paused, status, preferences } = useLumina();
  const location = useLocation();
  const isHub = location.pathname === "/hub";

  return (
    <div className={`lumina-workspace ${paused ? "is-paused" : ""}`}>
      <a className="skip-link" href="#workspace-content">Skip to workspace content</a>
      <header className="workspace-topbar">
        <BrandMark to="/hub" compact />
        <StatusHUD />
      </header>
      <div className="workspace-layout">
        <nav className="workspace-nav" aria-label="LuminaXR modules">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/hub"} aria-label={label} title={label}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
          <NavLink to="/settings" aria-label="Settings" title="Settings" className="workspace-nav__settings">
            <Settings2 aria-hidden="true" />
            <span>Settings</span>
          </NavLink>
        </nav>
        <main id="workspace-content" className={`workspace-content ${isHub ? "workspace-content--hub" : ""}`}>
          {!isHub && <div className="workspace-return-row"><ReturnToHubTarget /></div>}
          <Outlet />
        </main>
      </div>
      {paused && (
        <div className="paused-wash" aria-live="assertive">
          <span>LuminaXR paused</span>
          <strong>Movement remains available. Only Resume can activate.</strong>
        </div>
      )}
      {!preferences.guardianEnabled && !paused && status === "face-lost" && <div className="tracking-wash tracking-wash--danger" role="status"><strong>Face lost</strong><span>Move into camera view. The pointer is frozen and dwell has been cancelled.</span></div>}
      {!preferences.guardianEnabled && !paused && status === "low-confidence" && <div className="tracking-wash tracking-wash--warning" role="status"><strong>Tracking quality is reduced</strong><span>The pointer is frozen until the movement signal becomes reliable.</span></div>}
      {!preferences.guardianEnabled && !paused && status === "reacquiring" && <div className="tracking-wash" role="status"><strong>Face found</strong><span>Stabilizing before control is restored.</span></div>}
      <CameraPreview />
      <GuardianDock />
      <PresenterPanel />
      <ConfirmationOverlay />
    </div>
  );
}
