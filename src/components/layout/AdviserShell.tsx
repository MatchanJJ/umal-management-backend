'use client';

import {
  CalendarDaysIcon,
  ChartColumnIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  ScrollTextIcon,
  SettingsIcon,
  UserCheckIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { usePendingAccessCount } from '@/lib/api';
import { signOut } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import type { MeResponse } from '../../../shared/api';

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number };

function useNav(): NavItem[] {
  const { data: pending } = usePendingAccessCount(true);
  return [
    { href: '/dashboard/', label: 'Dashboard', icon: LayoutDashboardIcon },
    { href: '/events/', label: 'Events', icon: CalendarDaysIcon },
    { href: '/members/', label: 'Members', icon: UsersIcon },
    { href: '/access/', label: 'Access', icon: UserCheckIcon, badge: pending || undefined },
    { href: '/reports/fairness/', label: 'Reports', icon: ChartColumnIcon },
    { href: '/audit/', label: 'Audit', icon: ScrollTextIcon },
    { href: '/settings/', label: 'Settings', icon: SettingsIcon },
  ];
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon, badge }) => {
        const active = pathname === href || pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
              active
                ? 'bg-sidebar-primary text-sidebar-primary-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-secondary'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )}
          >
            <Icon className="size-4" strokeWidth={1.75} aria-hidden />
            <span className="flex-1">{label}</span>
            {badge ? (
              <span
                className={cn(
                  'min-w-5 rounded-full px-1.5 text-center text-xs font-semibold tabular-nums',
                  active ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground',
                )}
                aria-label={`${badge} pending`}
              >
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="px-3 pb-6">
      <p className="text-lg font-bold leading-tight text-primary">UMAL</p>
      <p className="text-xs font-medium text-muted-foreground">University of Mindanao</p>
    </div>
  );
}

export function UserMenu({ me }: { me: MeResponse }) {
  const initials = (me.member?.firstName?.[0] ?? me.user.name?.[0] ?? me.user.email[0]).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {initials}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{me.user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/me/profile/">Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => signOut()}>
          <LogOutIcon className="size-4" aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Design Brief §5 adviser shell: 256 px sidebar (sheet below 1024 px), 56 px top bar, 1280 px content. */
export function AdviserShell({ me, title, actions, children }: { me: MeResponse; title: string; actions?: ReactNode; children: ReactNode }) {
  const items = useNav();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-svh w-full">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar px-3 py-5 lg:block">
        <Brand />
        <NavLinks items={items} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background px-4 lg:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <MenuIcon className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar px-3 py-5">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <Brand />
              <NavLinks items={items} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-foreground">{title}</h1>
          </div>
          {actions}
          <UserMenu me={me} />
        </header>
        <main className="mx-auto w-full max-w-[1280px] flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
