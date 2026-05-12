import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { platformNavigation, workspaceNavigation } from "../config/navigation.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import BrandLogo from "./BrandLogo.jsx";
import Button from "./Button.jsx";
import ContextHelpWidget from "./ContextHelpWidget.jsx";
import Icon from "./Icon.jsx";
import GuidedTourPopover from "./onboarding/GuidedTourPopover.jsx";
import PageTransition from "./PageTransition.jsx";
import WelcomeOnboardingModal from "./onboarding/WelcomeOnboardingModal.jsx";

const OPEN_MODULES_KEY = "agensync_sidebar_open_modules";

function desktopLinkClass({ isActive }) {
  return [
    "group relative flex min-h-10 items-center gap-3 rounded-xl border-l-2 px-3 text-sm font-bold transition duration-200 active:scale-[0.99]",
    isActive
      ? "border-l-[#60A5FA] bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
      : "border-l-transparent text-slate-400 hover:bg-white/[0.06] hover:text-white"
  ].join(" ");
}

function mobileLinkClass({ isActive }) {
  return [
    "group relative flex min-h-11 items-center gap-3 rounded-xl border-l-2 px-3 text-sm font-bold transition duration-200 active:scale-[0.99]",
    isActive
      ? "border-l-[#60A5FA] bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
      : "border-l-transparent text-slate-400 hover:bg-white/[0.06] hover:text-white"
  ].join(" ");
}

function AccountMark({ user, size = "sm" }) {
  const sizeClass = size === "lg" ? "h-10 w-10 rounded-2xl" : "h-9 w-9 rounded-xl";

  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden bg-white/10 text-sm font-extrabold text-white ring-1 ring-white/10`}
    >
      {user?.businessLogo ? (
        <img src={user.businessLogo} alt={`Logo ${user.businessName || "do negócio"}`} className="h-full w-full object-cover" />
      ) : (
        (user?.businessName || user?.name)?.slice(0, 1) || "A"
      )}
    </div>
  );
}

function childLinkClass({ isActive }) {
  return [
    "group ml-8 flex min-h-9 items-center rounded-xl px-3 text-xs font-bold transition duration-200 active:scale-[0.99]",
    isActive ? "bg-white/[0.09] text-white" : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
  ].join(" ");
}

function isItemActive(item, pathname) {
  if (item.to) return item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
  return item.children?.some((child) => child.to === "/" ? pathname === "/" : pathname.startsWith(child.to));
}

function flattenNavigation(items) {
  return items.flatMap((item) => [item, ...(item.children || [])]);
}

function filterNavigation(items, { isAdmin, canAccess }) {
  return items
    .filter((item) => (!item.adminOnly || isAdmin) && canAccess(item.permission))
    .map((item) => ({
      ...item,
      children: item.children?.filter((child) => canAccess(child.permission)) || []
    }))
    .filter((item) => item.to || item.children.length);
}

function readOpenModules() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(OPEN_MODULES_KEY) || "{}");
  } catch {
    return {};
  }
}

function SidebarBrand() {
  return (
    <div className="flex items-center justify-center pb-4 pt-2">
      <BrandLogo src="/AgenSync_sidebar.png" className="h-14 w-56 shrink-0" />
    </div>
  );
}

function SidebarNavigation({ items, openModules, onToggleModule, onNavigate, pathname, linkClass = desktopLinkClass }) {
  return (
    <>
      {items.map((item) => {
        const hasChildren = item.children?.length > 0;
        const open = Boolean(openModules[item.id]) || isItemActive(item, pathname);

        if (!hasChildren) {
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={linkClass}
              end={item.to === "/"}
              onClick={onNavigate}
              data-tour-id={item.tourId || undefined}
            >
              <Icon name={item.icon} className="h-5 w-5 opacity-90 transition group-hover:opacity-100" />
              {item.label}
            </NavLink>
          );
        }

        return (
          <div key={item.id} className="space-y-1">
            <button
              type="button"
              onClick={() => onToggleModule(item.id)}
              className={[
                "group flex min-h-10 w-full items-center gap-3 rounded-xl border-l-2 px-3 text-left text-sm font-bold transition duration-200 active:scale-[0.99]",
                open
                  ? "border-l-[#60A5FA] bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "border-l-transparent text-slate-400 hover:bg-white/[0.06] hover:text-white"
              ].join(" ")}
              data-tour-id={item.tourId || undefined}
              aria-expanded={open}
            >
              <Icon name={item.icon} className="h-5 w-5 opacity-90 transition group-hover:opacity-100" />
              <span className="min-w-0 flex-1">{item.label}</span>
              <span className={`text-xs transition duration-200 ${open ? "rotate-90" : ""}`}>›</span>
            </button>
            <div className={`grid transition-all duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="min-h-0 overflow-hidden">
                <div className="space-y-1 py-1">
                  {item.children.map((child) => (
                    <NavLink key={child.to} to={child.to} className={childLinkClass} onClick={onNavigate}>
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

function titleFromPath(pathname) {
  if (pathname.startsWith("/admin")) return "Painel Admin";
  if (pathname.startsWith("/plataforma")) return "Plataforma";
  if (pathname.startsWith("/agendamentos")) return "Agendar";
  if (pathname.startsWith("/relatorios")) return "Relatórios";

  const allNavigationItems = flattenNavigation([...workspaceNavigation, ...platformNavigation]);
  const found = allNavigationItems.find((item) =>
    item.to === "/" ? pathname === "/" : pathname.startsWith(item.to)
  );

  return found?.label || "AgenSync";
}

function mobileActionFor(pathname, navigate) {
  if (pathname === "/" || pathname.startsWith("/agenda")) {
    return {
      label: "Novo",
      icon: "appointments",
      onClick: () => navigate("/agendamentos")
    };
  }

  if (pathname.startsWith("/financeiro") || pathname.startsWith("/relatorios")) {
    return {
      label: "Excel",
      icon: "reports",
      onClick: () => window.dispatchEvent(new Event("agensync:export-finance"))
    };
  }

  return null;
}

export default function Layout() {
  const { user, logout, isAdmin, canAccess, hasPlatformAccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openModules, setOpenModules] = useState(readOpenModules);
  const accountName = user?.businessName || user?.name || "Seu negócio";
  const mobileTitle = titleFromPath(location.pathname);
  const mobileAction = mobileActionFor(location.pathname, navigate);
  const baseNavigation = hasPlatformAccess ? platformNavigation : workspaceNavigation;
  const visibleNavigation = useMemo(
    () => (hasPlatformAccess ? baseNavigation : filterNavigation(baseNavigation, { isAdmin, canAccess })),
    [baseNavigation, canAccess, hasPlatformAccess, isAdmin]
  );

  useEffect(() => {
    const activeModules = {};
    visibleNavigation.forEach((item) => {
      if (item.id && isItemActive(item, location.pathname)) activeModules[item.id] = true;
    });

    if (Object.keys(activeModules).length) {
      setOpenModules((current) => ({ ...current, ...activeModules }));
    }
  }, [location.pathname, visibleNavigation]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(OPEN_MODULES_KEY, JSON.stringify(openModules));
  }, [openModules]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  function toggleModule(moduleId) {
    setOpenModules((current) => ({ ...current, [moduleId]: !current[moduleId] }));
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#F1F5F9] text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-72 rounded-r-[30px] border border-white/10 bg-gradient-to-b from-[#111827] via-[#0F172A] to-[#020617] p-4 shadow-[0_28px_70px_rgba(15,23,42,0.34)] lg:block">
        <div className="flex h-full flex-col">
          <SidebarBrand />

          {!hasPlatformAccess ? (
            <button
              type="button"
              onClick={() => navigate("/agendamentos")}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-blue-400/20 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] px-4 text-sm font-black text-white shadow-[0_16px_32px_rgba(37,99,235,0.28)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_38px_rgba(37,99,235,0.34)] active:translate-y-0 active:scale-[0.98]"
            >
              <Icon name="appointments" className="h-5 w-5" />
              Novo agendamento
            </button>
          ) : null}

          <nav className="agensync-sidebar-scroll mt-4 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
            <SidebarNavigation
              items={visibleNavigation}
              openModules={openModules}
              onToggleModule={toggleModule}
              pathname={location.pathname}
            />
          </nav>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
            <div className="flex items-center gap-3">
              <AccountMark user={user} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{accountName}</p>
                <p className="truncate text-xs text-slate-400">{user?.email}</p>
              </div>
            </div>
            <Button variant="dark" size="sm" className="mt-3 w-full" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 border-b border-[#E2E8F0] bg-white/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white text-ink shadow-sm transition active:scale-95"
            aria-label="Abrir menu"
          >
            <span className="space-y-1.5">
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
            </span>
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-brand">AgenSync</p>
            <h1 className="truncate text-xl font-black tracking-tight text-ink">{mobileTitle}</h1>
          </div>

          {mobileAction ? (
            <button
              type="button"
              onClick={mobileAction.onClick}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-brand px-4 text-sm font-black text-white shadow-[0_12px_24px_rgba(37,99,235,0.24)] transition active:scale-95"
            >
              <Icon name={mobileAction.icon} className="h-4 w-4" />
              {mobileAction.label}
            </button>
          ) : null}
        </div>
      </header>

      {drawerOpen ? (
        <div className="agensync-overlay z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
            onClick={closeDrawer}
            aria-label="Fechar menu"
          />
          <aside className="agensync-drawer-panel relative flex h-full w-[86vw] max-w-[320px] flex-col rounded-r-[30px] border-r border-white/10 bg-gradient-to-b from-[#111827] via-[#0F172A] to-[#020617] p-4 shadow-[24px_0_70px_rgba(15,23,42,0.42)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-1 justify-center pt-1">
                <BrandLogo src="/AgenSync_sidebar.png" className="h-14 w-56 shrink-0" />
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07] text-lg font-black text-white transition hover:bg-white/[0.12] active:scale-95"
                aria-label="Fechar menu"
              >
                X
              </button>
            </div>

            {!hasPlatformAccess ? (
              <button
                type="button"
                onClick={() => {
                  closeDrawer();
                  navigate("/agendamentos");
                }}
                className="mt-5 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-blue-400/20 bg-gradient-to-r from-[#3225eb] to-[#1D4ED8] px-4 py-3 text-sm font-black text-white shadow-[0_16px_32px_rgba(37,99,235,0.28)] transition active:scale-[0.98]"
              >
                <Icon name="appointments" className="h-5 w-5" />
                Novo agendamento
              </button>
            ) : null}

            <nav className="agensync-sidebar-scroll mt-4 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
              <SidebarNavigation
                items={visibleNavigation}
                openModules={openModules}
                onToggleModule={toggleModule}
                onNavigate={closeDrawer}
                pathname={location.pathname}
                linkClass={mobileLinkClass}
              />
            </nav>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
              <div className="flex items-center gap-3">
                <AccountMark user={user} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">{accountName}</p>
                  <p className="truncate text-xs font-medium text-slate-400">{user?.email}</p>
                </div>
              </div>
              <Button variant="dark" size="sm" className="mt-3 w-full" onClick={handleLogout}>
                Sair
              </Button>
            </div>
          </aside>
        </div>
      ) : null}

      <main className="min-h-screen min-w-0 max-w-full overflow-x-hidden px-4 pb-6 pt-[calc(env(safe-area-inset-top)+6rem)] sm:px-6 lg:pb-6 lg:pl-80 lg:pr-8 lg:pt-4 xl:pr-10">
        <div className="mx-auto min-w-0 max-w-[1440px] overflow-x-hidden">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </div>
      </main>

      <WelcomeOnboardingModal />
      <GuidedTourPopover />
      <ContextHelpWidget />
    </div>
  );
}

