import type { BrandProfile } from "@studio/schemas";

interface Props {
  palette: BrandProfile["visual"]["palette"];
}

export function PaletteCard({ palette }: Props) {
  if (palette.length === 0) return null;
  return (
    <div className="palette-card">
      <header>
        <span className="card-eyebrow">visual · palette</span>
      </header>
      <ul className="swatches">
        {palette.map((c) => (
          <li key={`${c.name}-${c.hex}`}>
            <span className="sw" style={{ background: c.hex }}></span>
            <div>
              <p>{c.name}</p>
              <p className="mono">{c.hex.toUpperCase()}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
