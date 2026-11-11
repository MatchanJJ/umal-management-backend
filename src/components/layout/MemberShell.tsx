'use client';

import { MenuIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { MeResponse } from '../../../shared/api';
import { AdviserShell, UserMenu } from './AdviserShell';

const NAV = [
  { href: '/me/', label: 'Home' },
  { href: '/me/schedule/', label: 'My Schedule' },
  { href: '/me/availability/', label: 'Availability' },
  { href: '/me/history/', label: 'History' },
  { href: '/events/', label: 'Events' },
];

function NavLinks({ onNavigate, vertical }: { onNavigate?: () => void; vertical?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={cn('flex gap-1', vertical && 'flex-col')}>
      {NAV.map(({ href, label }) => {
        // '/me/' is a prefix of every member page, so Home only matches exactly.
        const active = href === '/me/' ? pathname === href : pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors',
              active ? 'bg-[#FBE9EA] text-primary' : 'text-sidebar-foreground hover:bg-sidebar-accent',
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Design Brief §5 member shell: white top bar, UMAL mark left, nav centred, 960 px content. */
export function MemberShell({ me, title, children }: { me: MeResponse; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <MenuIcon className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 px-3 py-5">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <NavLinks vertical onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link href="/me/" className="leading-tight">
            <span className="block text-base font-bold text-primary">UMAL</span>
            <span className="hidden text-[11px] font-medium text-muted-foreground sm:block">University of Mindanao</span>
          </Link>
          <div className="hidden flex-1 justify-center md:flex">
            <NavLinks />
          </div>
          <div className="ml-auto md:ml-0">
            <UserMenu me={me} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[960px] flex-1 p-4 sm:p-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        <span aria-hidden className="mt-2 mb-6 block h-[3px] w-10 bg-secondary" />
        {children}
      </main>
    </div>
  );
}

/** Pages both roles can open (profile, schedule) wear the shell of the viewer's role. */
export function AppShell({ me, title, children }: { me: MeResponse; title: string; children: ReactNode }) {
  return me.member?.role === 'adviser' ? (
    <AdviserShell me={me} title={title}>
      {children}
    </AdviserShell>
  ) : (
    <MemberShell me={me} title={title}>
      {children}
    </MemberShell>
  );
}
