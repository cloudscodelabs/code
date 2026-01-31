import { Sidebar } from './Sidebar.js';
import { TopBar } from './TopBar.js';
import { ChatView } from '../chat/ChatView.js';

export function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <div className="flex flex-1 min-h-0">
          <main className="flex-1 min-w-0">
            <ChatView />
          </main>
        </div>
      </div>
    </div>
  );
}
