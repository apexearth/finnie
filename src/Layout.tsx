import { DockviewReact, type DockviewReadyEvent, type IDockviewPanelProps } from "dockview-react";
import { ChartPanel } from "./panels/Chart";
import { Details } from "./panels/Details";
import { Watchlist } from "./panels/Watchlist";
import { finnieTheme, initDock } from "./dock";

const components = {
  watchlist: () => <Watchlist />,
  details: () => <Details />,
  chart: ({ api }: IDockviewPanelProps) => <ChartPanel id={api.id} api={api} />,
};

function Watermark() {
  return <div className="empty">empty: pick a symbol in the watchlist, or press Ctrl+K</div>;
}

export function Layout() {
  const onReady = (e: DockviewReadyEvent) => initDock(e.api);
  return (
    <div className="dock">
      <DockviewReact theme={finnieTheme} components={components} watermarkComponent={Watermark} onReady={onReady} />
    </div>
  );
}
