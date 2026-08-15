import { Link } from "react-router-dom";

export function BrandGlyph({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-glyph ${compact ? "brand-glyph--compact" : ""}`} aria-hidden="true">
      <span className="brand-glyph__core" />
      <span className="brand-glyph__orbit brand-glyph__orbit--one" />
      <span className="brand-glyph__orbit brand-glyph__orbit--two" />
    </span>
  );
}

export function BrandMark({ to = "/", compact = false }: { to?: string; compact?: boolean }) {
  return (
    <Link to={to} className="brand-mark" aria-label="LuminaXR Access home">
      <BrandGlyph compact={compact} />
      <span className="brand-mark__text">
        <strong>LuminaXR</strong>
        {!compact && <span>Access</span>}
      </span>
    </Link>
  );
}
