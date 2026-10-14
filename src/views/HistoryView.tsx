import { TabBar } from '../components/TabBar';

export function HistoryView() {
  return (
    <>
      <main class="screen with-tabbar">
        <header class="topbar" style={{ justifyContent: 'flex-start' }}>
          <h1 class="page-title">Historia</h1>
        </header>
        <div class="empty">Historia pojawi się w kolejnym etapie.</div>
      </main>
      <div class="bottom">
        <TabBar active="history" />
      </div>
    </>
  );
}
