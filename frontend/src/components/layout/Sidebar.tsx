'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Store,
  FlaskConical,
  Pill,
  PackagePlus,
  Boxes,
  ShoppingBag,
  Receipt,
  Bell,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { useAlertsBadgeCount } from '../../features/alerts/hooks';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const adminNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Users', href: '/users', icon: Users },
  { label: 'Retailers', href: '/retailers', icon: Store },
  { label: 'Salts Master', href: '/salts', icon: FlaskConical },
  { label: 'Medicines', href: '/medicines', icon: Pill },
  { label: 'Stock Inward', href: '/stock/inward', icon: PackagePlus },
  { label: 'Batches', href: '/batches', icon: Boxes },
  { label: 'Orders Queue', href: '/orders', icon: ShoppingBag },
  { label: 'Tax Invoices', href: '/invoices', icon: Receipt },
  { label: 'Alerts', href: '/alerts', icon: Bell },
  { label: 'Settings', href: '/settings', icon: Settings },
];

const STORAGE_KEY = 'kd_sidebar_collapsed';
const TOGGLE_EVENT = 'kd_sidebar_toggle';

function subscribeSidebar(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener(TOGGLE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(TOGGLE_EVENT, callback);
  };
}

function getSidebarSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function getServerSidebarSnapshot(): boolean {
  return false;
}

export interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { data: alertCount } = useAlertsBadgeCount();

  const isCollapsed = useSyncExternalStore(
    subscribeSidebar,
    getSidebarSnapshot,
    getServerSidebarSnapshot
  );

  const toggleCollapse = () => {
    try {
      const current = getSidebarSnapshot();
      localStorage.setItem(STORAGE_KEY, String(!current));
      window.dispatchEvent(new Event(TOGGLE_EVENT));
    } catch {
      // Ignore localStorage access failures
    }
  };

  // Close mobile drawer only when navigating to a different pathname
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      if (mobileOpen) {
        onCloseMobile?.();
      }
    }
  }, [pathname, mobileOpen, onCloseMobile]);

  // Guard against synthetic click bleed-through when opening on mobile
  const openTimeRef = useRef(0);
  useEffect(() => {
    if (mobileOpen) {
      openTimeRef.current = Date.now();
    }
  }, [mobileOpen]);

  const handleBackdropClose = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.stopPropagation?.();
    }
    // Ignore synthetic click bleed-through from the opening tap gesture
    if (Date.now() - openTimeRef.current < 400) {
      return;
    }
    onCloseMobile?.();
  };

  // Close mobile drawer when pressing Escape key
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseMobile?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  // Lock background body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <>
      {/* ------------------------------------------------------------- */}
      {/* DESKTOP SIDEBAR: Viewport height constrained, sticky on left   */}
      {/* ------------------------------------------------------------- */}
      <aside
        aria-label="Admin Navigation Sidebar"
        className={`hidden lg:flex bg-slate-900 text-slate-300 flex-col h-screen h-[100dvh] max-h-screen sticky top-0 border-r border-slate-800 transition-all duration-300 ease-in-out shrink-0 select-none z-20 ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Desktop Header */}
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-3 shrink-0">
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
                  KD
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-white text-base tracking-wide block truncate">KD-IOMS</span>
                  <span className="block text-[11px] text-emerald-400 font-medium truncate leading-tight">
                    Wholesale Admin
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleCollapse}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors touch-manipulation cursor-pointer"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </>
          ) : (
            <div className="w-full flex flex-col items-center justify-center">
              <button
                type="button"
                onClick={toggleCollapse}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors touch-manipulation cursor-pointer"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="h-5 w-5 text-emerald-400" />
              </button>
            </div>
          )}
        </div>

        {/* Desktop Navigation (Scrolls internally within viewport height) */}
        <nav
          className={`flex-1 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden scrollbar-none min-h-0 ${
            isCollapsed ? 'px-2' : 'px-3'
          }`}
        >
          {adminNavItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const isAlert = item.href === '/alerts';
            const showAlertBadge = isAlert && typeof alertCount === 'number' && alertCount > 0;
            const Icon = item.icon;

            return (
              <Link
                key={`desktop-${item.href}`}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                className={`group relative flex items-center rounded-lg text-xs font-medium transition-all ${
                  isCollapsed
                    ? 'justify-center h-10 w-10 mx-auto'
                    : 'justify-between px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {/* Alert Badge */}
                {showAlertBadge &&
                  (!isCollapsed ? (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-sm shrink-0">
                      {alertCount}
                    </span>
                  ) : (
                    <span
                      className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-slate-900"
                      aria-label={`${alertCount} alerts`}
                    />
                  ))}

                {/* Hover Floating Tooltip when collapsed */}
                {isCollapsed && (
                  <div className="pointer-events-none absolute left-full ml-2.5 z-50 hidden rounded-md bg-slate-800 px-2.5 py-1 text-xs font-medium text-white shadow-xl ring-1 ring-slate-700 whitespace-nowrap group-hover:block">
                    {item.label}
                    {showAlertBadge && ` (${alertCount})`}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Footer / User Profile & Sign Out */}
        <div className={`border-t border-slate-800 shrink-0 ${isCollapsed ? 'p-2' : 'p-3.5'}`}>
          {!isCollapsed ? (
            <div>
              <div className="flex items-center gap-2.5 mb-2 px-1">
                <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0">
                  {(user?.username || 'A').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-200 truncate">{user?.username || 'Admin'}</p>
                  <p className="text-[10px] text-slate-400 truncate capitalize">
                    {user?.role?.toLowerCase() || 'Administrator'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 font-medium transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0 cursor-default"
                title={`Signed in as ${user?.username || 'Admin'}`}
              >
                {(user?.username || 'A').charAt(0).toUpperCase()}
              </div>
              <button
                type="button"
                onClick={logout}
                className="group relative p-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="h-4 w-4" />
                <div className="pointer-events-none absolute left-full ml-2.5 z-50 hidden rounded-md bg-slate-800 px-2.5 py-1 text-xs font-medium text-rose-300 shadow-xl ring-1 ring-slate-700 whitespace-nowrap group-hover:block">
                  Sign Out
                </div>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* MOBILE DRAWER: Off-canvas overlay on mobile devices (< lg)    */}
      {/* ------------------------------------------------------------- */}
      <div className="lg:hidden">
        {/* Backdrop overlay */}
        <div
          className={`fixed inset-0 bg-slate-950/70 z-40 backdrop-blur-xs transition-opacity duration-300 cursor-pointer touch-manipulation ${
            mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          style={{
            opacity: mobileOpen ? 1 : 0,
            pointerEvents: mobileOpen ? 'auto' : 'none',
          }}
          onClick={handleBackdropClose}
          onTouchEnd={handleBackdropClose}
          aria-hidden="true"
        />

        {/* Off-canvas Drawer Panel */}
        <aside
          aria-label="Mobile Navigation Drawer"
          aria-hidden={!mobileOpen}
          className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-slate-900 text-slate-300 flex flex-col h-screen h-[100dvh] max-h-screen border-r border-slate-800 shadow-2xl transition-transform duration-300 ease-in-out select-none ${
            mobileOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'
          }`}
          style={{
            transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
            pointerEvents: mobileOpen ? 'auto' : 'none',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile Header with brand & close button */}
          <div className="h-14 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
                KD
              </div>
              <div className="min-w-0">
                <span className="font-bold text-white text-base tracking-wide block truncate">KD-IOMS</span>
                <span className="block text-[11px] text-emerald-400 font-medium truncate leading-tight">
                  Wholesale Admin
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCloseMobile?.();
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCloseMobile?.();
              }}
              className="p-2 -mr-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors touch-manipulation cursor-pointer"
              title="Close navigation"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mobile Nav Links */}
          <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto min-h-0">
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              const isAlert = item.href === '/alerts';
              const showAlertBadge = isAlert && typeof alertCount === 'number' && alertCount > 0;
              const Icon = item.icon;

              return (
                <Link
                  key={`mobile-${item.href}`}
                  href={item.href}
                  onClick={() => onCloseMobile?.()}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {showAlertBadge && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-sm shrink-0">
                      {alertCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Mobile Footer */}
          <div className="p-4 border-t border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5 mb-3 px-1">
              <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0">
                {(user?.username || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-200 truncate">{user?.username || 'Admin'}</p>
                <p className="text-[10px] text-slate-400 truncate capitalize">
                  {user?.role?.toLowerCase() || 'Administrator'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onCloseMobile?.();
                logout();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 font-medium transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
