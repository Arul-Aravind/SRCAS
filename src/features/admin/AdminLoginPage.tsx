import { type FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AssistiveTarget } from "@/components/luminax/AssistiveTarget";
import { BrandGlyph, BrandMark } from "@/components/luminax/BrandMark";
import { ADMIN_SESSION_KEY, validateAdminCredentials } from "@/lib/adminAuth";
import "./admin.css";

type AdminStage = "login" | "welcome";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [stage, setStage] = useState<AdminStage>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = stage === "welcome" ? "Welcome, Admin · LuminaXR" : "Admin Login · LuminaXR";
    headingRef.current?.focus();
  }, [stage]);

  useEffect(() => {
    if (stage !== "welcome") return;
    const timer = window.setTimeout(() => navigate("/hub", { replace: true }), 2600);
    return () => window.clearTimeout(timer);
  }, [navigate, stage]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateAdminCredentials(username, password)) {
      setError("The username or password is incorrect.");
      return;
    }

    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    setError("");
    setStage("welcome");
  };

  if (stage === "welcome") {
    return (
      <main className="admin-welcome" aria-live="polite" aria-busy="true">
        <div className="admin-welcome__scan" aria-hidden="true" />
        <div className="admin-welcome__content">
          <div className="admin-welcome__mark"><BrandGlyph /><span /><i /></div>
          <p>ADMIN SESSION VERIFIED</p>
          <h1 ref={headingRef} tabIndex={-1}>Welcome, Admin.</h1>
          <span>Preparing your LuminaXR control environment.</span>
          <div className="admin-welcome__progress" aria-label="Opening Access Hub"><i /></div>
          <div className="admin-welcome__steps" aria-hidden="true">
            <div><Check /><span>IDENTITY</span><strong>Verified</strong></div>
            <div><ShieldCheck /><span>SESSION</span><strong>Protected</strong></div>
            <div><ArrowRight /><span>DESTINATION</span><strong>Access Hub</strong></div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="admin-auth-page">
      <header className="admin-auth-header">
        <BrandMark />
        <Link to="/"><ArrowLeft aria-hidden="true" /> Public site</Link>
      </header>
      <main className="admin-auth-main">
        <section className="admin-auth-context" aria-label="LuminaXR administration">
          <div className="admin-auth-context__glyph"><BrandGlyph /><span /></div>
          <p>CONTROL ENVIRONMENT</p>
          <h1>Quiet access.<br />Clear oversight.</h1>
          <span>Enter the secure operator workspace for the LuminaXR demonstration.</span>
          <div className="admin-auth-signals" aria-hidden="true">
            <div><i /><span>LOCAL SESSION</span></div>
            <div><i /><span>ACCESS CONTROLS READY</span></div>
          </div>
        </section>

        <section className="admin-login-panel">
          <div className="admin-login-panel__eyebrow"><ShieldCheck aria-hidden="true" /> ADMINISTRATOR ACCESS</div>
          <h2 ref={headingRef} tabIndex={-1}>Sign in to LuminaXR</h2>
          <p>Use your administrator credentials to continue to the Access Hub.</p>

          <form onSubmit={submit} noValidate>
            <label htmlFor="admin-username">Username</label>
            <div className="admin-input-wrap">
              <UserRound aria-hidden="true" />
              <input
                id="admin-username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => { setUsername(event.target.value); setError(""); }}
                placeholder="Enter username"
                required
                autoFocus
              />
            </div>

            <label htmlFor="admin-password">Password</label>
            <div className="admin-input-wrap">
              <LockKeyhole aria-hidden="true" />
              <input
                id="admin-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => { setPassword(event.target.value); setError(""); }}
                placeholder="Enter password"
                required
              />
              <button className="admin-password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </div>

            <div className={`admin-login-error ${error ? "is-visible" : ""}`} role="alert">{error || " "}</div>
            <AssistiveTarget
              type="submit"
              targetId="admin-login-submit"
              label="Sign in as administrator"
              tone="cyan"
              className="admin-login-submit"
              dwellMs={1000}
              disabled={!username || !password}
            >
              <span>Continue to Access Hub</span><ArrowRight aria-hidden="true" />
            </AssistiveTarget>
          </form>
          <footer><LockKeyhole aria-hidden="true" /> Credentials are checked in this demonstration session.</footer>
        </section>
      </main>
    </div>
  );
}
