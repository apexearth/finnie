import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "dockview-react/dist/styles/dockview.css";
import "./styles.css";
import { App } from "./App";
import { startPolling } from "./data/poll";
import { loadSettings, saveDevice } from "./settings";
import { initStore } from "./store";
import { applyTheme, initTheme } from "./theme";

function Crash({ error, onResetLayout }: { error: Error; onResetLayout?: () => void }) {
  return (
    <div className="crash">
      <h3>Finnie hit an error</h3>
      <pre>{error.stack ?? error.message}</pre>
      <button onClick={() => location.reload()}>reload</button>{" "}
      {onResetLayout && <button onClick={onResetLayout}>reset layout and reload</button>}
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const e = this.state.error;
    if (!e) return this.props.children;
    return <Crash error={e} onResetLayout={() => { saveDevice({ layout: undefined }); setTimeout(() => location.reload(), 400); }} />;
  }
}

document.documentElement.dataset.platform = /Mac/.test(navigator.platform) ? "mac" : "other";
const root = createRoot(document.getElementById("root")!);
applyTheme();
// Nothing draws until the settings file is read: the lists, layout and theme all come from it.
loadSettings().then(
  (f) => {
    initStore(f);
    initTheme();
    void startPolling();
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>,
    );
  },
  (e) => root.render(<Crash error={e instanceof Error ? e : new Error(String(e))} />),
);
