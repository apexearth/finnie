import { MOD } from "./platform";

const KEYS: [string[], string][] = [
  [[`${MOD}+K`, "/"], "go to symbol"],
  [["a"], "add a symbol to this watchlist"],
  [["↑", "↓"], "step through the watchlist"],
  [["1", "…", "8"], "chart range: 1D 5D 1M 6M YTD 1Y 5Y MAX"],
  [["r"], "refresh quotes now"],
  [["Shift+Enter"], "in the picker: open in a new chart"],
  [["Ctrl+Enter"], "in the picker: add to the watchlist"],
  [["double-click"], "a watchlist row opens it in a new chart"],
  [[`${MOD}+Shift+R`], "reset layout"],
  [[`${MOD}+/`], "this list"],
];

export function Keys({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 460 }}>
        <h3>Keyboard</h3>
        <div style={{ padding: "6px 0 10px" }}>
          {KEYS.map(([combo, what]) => (
            <div key={what} className="keys-row">
              <span className="keys-combo">{combo.map((k, i) => (k === "…" ? <span key={i} className="dim"> … </span> : <kbd key={i} style={{ marginRight: 4 }}>{k}</kbd>))}</span>
              <span className="keys-what">{what}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
