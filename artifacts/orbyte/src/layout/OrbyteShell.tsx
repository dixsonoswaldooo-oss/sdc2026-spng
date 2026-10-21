import { X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Dialog } from '@/components/Dialog';
import { DEMO_MODE } from '@/lib/env';
import { DemoControls } from './DemoControls';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/** The mock Orbyte workspace: menu on the left (a slide-in menu on phones), top bar, page content. */
export function OrbyteShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-line bg-surface lg:block">
        <div className="sticky top-0">
          <Sidebar />
        </div>
      </aside>

      <Dialog open={menuOpen} onClose={closeMenu} labelledBy="mobile-menu-title" side="left">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id="mobile-menu-title" className="text-sm font-medium">
            Menu
          </h2>
          <button type="button" onClick={closeMenu} className="rounded-input p-2 hover:bg-canvas" aria-label="Close menu">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <Sidebar onNavigate={closeMenu} />
      </Dialog>

      <div className="flex min-w-0 flex-col">
        <TopBar onOpenMenu={() => setMenuOpen(true)} />
        <main className="mx-auto w-full max-w-content flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pt-8">{children}</main>
      </div>
      {DEMO_MODE && <DemoControls />}
    </div>
  );
}
