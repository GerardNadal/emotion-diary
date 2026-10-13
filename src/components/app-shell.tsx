"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  BookOpen,
  ChartNoAxesColumnIncreasing,
  Leaf,
  UserRound,
  UsersRound,
  Network,
  Heart,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { logoutAction } from "@/modules/auth/actions";
import { roleLabels } from "@/modules/auth/roles";
import {
  navigationForRole,
  isNavigationActive,
} from "@/modules/shared/navigation";
import type { AppRole } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const icons = {
  home: House,
  journal: BookOpen,
  chart: ChartNoAxesColumnIncreasing,
  leaf: Leaf,
  profile: UserRound,
  users: UsersRound,
  teams: Network,
  heart: Heart,
};
export function AppShell({
  profile,
  children,
}: {
  profile: { full_name: string; role: AppRole };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const menuButton = useRef<HTMLButtonElement>(null);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const { personal, administration } = navigationForRole(profile.role);
  const entries = [...personal, ...administration];
  const active = entries.find((item) =>
    isNavigationActive(pathname, item.href),
  );
  const initials = profile.full_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
  function links(items: ReadonlyArray<(typeof entries)[number]>) {
    return items.map((item) => {
      const Icon = icons[item.icon as keyof typeof icons];
      const selected = isNavigationActive(pathname, item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          className={cn("nav-link", selected && "selected")}
          aria-current={selected ? "page" : undefined}
          onClick={() => setOpenPath(null)}
        >
          <Icon aria-hidden="true" />
          <span>{item.label}</span>
        </Link>
      );
    });
  }
  return (
    <div
      className="app-shell"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpenPath(null);
          menuButton.current?.focus();
        }
      }}
    >
      <a className="skip-link" href="#main">
        Ir al contenido
      </a>
      <header className="mobile-header">
        <Link href={personal[0].href} aria-label="Dentro, mi espacio">
          <Brand />
        </Link>
        <Button
          ref={menuButton}
          variant="ghost"
          size="icon-lg"
          aria-label={open ? "Cerrar navegación" : "Abrir navegación"}
          aria-expanded={open}
          aria-controls="app-navigation"
          onClick={() => setOpenPath(open ? null : pathname)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </header>
      <aside
        id="app-navigation"
        className={cn("sidebar", open && "mobile-open")}
      >
        <Link
          className="sidebar-brand"
          href={personal[0].href}
          aria-label="Dentro, mi espacio"
        >
          <Brand />
        </Link>
        <nav aria-label="Navegación principal" className="sidebar-nav">
          {links(personal)}
          {administration.length ? (
            <>
              <Separator />
              <p className="nav-caption">Administración</p>
              {links(administration)}
            </>
          ) : null}
        </nav>
        <div className="sidebar-bottom">
          <Link className="profile-link" href="/profile">
            <span className="initials">{initials}</span>
            <span className="profile-name">
              <strong>{profile.full_name}</strong>
              <small>{roleLabels[profile.role]}</small>
            </span>
            <ChevronRight aria-hidden="true" />
          </Link>
          <form action={logoutAction}>
            <Button variant="ghost" type="submit">
              <LogOut data-icon="inline-start" />
              Cerrar sesión
            </Button>
          </form>
        </div>
      </aside>
      <div className="app-body">
        <header className="desktop-header">
          <span>{active?.label ?? "Mi diario"}</span>
        </header>
        <main id="main" tabIndex={-1} className="page-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>Dentro · Tu espacio de bienestar</span>
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="Accesos rápidos">
        {links(
          profile.role === "employee"
            ? personal.slice(0, 4)
            : [...administration.slice(0, 3), personal[0]],
        )}
      </nav>
    </div>
  );
}
