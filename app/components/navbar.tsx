"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import logo from "./images/logo.png";

export default function Navbar() {
  const [user, setUser] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      try { setUser(localStorage.getItem('map_user')); } catch { setUser(null); }
      try { setRole(localStorage.getItem('map_user_role')); } catch { setRole(null); }
    };
    read();
    // support a one-time URL trigger to clear client-side app data immediately:
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('clear') === 'true') {
          try { localStorage.removeItem('map_pins'); localStorage.removeItem('map_messages'); localStorage.removeItem('map_user'); localStorage.removeItem('map_user_role'); } catch {}
          try { window.dispatchEvent(new StorageEvent('storage', { key: 'map_pins', newValue: null } as any)); } catch {}
          try { window.dispatchEvent(new StorageEvent('storage', { key: 'map_messages', newValue: null } as any)); } catch {}
          try { window.dispatchEvent(new StorageEvent('storage', { key: 'map_user', newValue: null } as any)); } catch {}
          try { window.dispatchEvent(new CustomEvent('map_user_changed', { detail: null })); } catch {}
          params.delete('clear');
          const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
          window.history.replaceState({}, document.title, newUrl);
          window.location.reload();
        }
      }
    } catch {}
    const onStorage = (e: StorageEvent) => { if (e.key === 'map_user') read(); };
    const onCustom = (e: any) => { read(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('map_user_changed', onCustom as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('map_user_changed', onCustom as EventListener);
    };
  }, []);

  return (
    <nav className="w-full h-16 bg-white border-b border-gray-200 flex items-center px-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative w-9 h-9">
            <Image src={logo} alt="ReSurge logo" width={36} height={36} style={{ objectFit: 'contain' }} />
          </div>
          <div className="text-2xl font-extrabold text-black">ReSurge</div>
        <div className="text-sm text-gray-700">— connect, reconciliate, reborn</div>
        </Link>
      </div>
      <div className="ml-auto flex items-center gap-3">
        {user ? (
            <div className="flex items-center gap-3">
            <div className="flex flex-col items-start">
              <div className="text-sm font-semibold text-black">{user}</div>
              {role ? (
                <div className="mt-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  {role === 'support' ? 'Support' : 'Need support'}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  try { localStorage.removeItem('map_user'); localStorage.removeItem('map_user_role'); } catch {}
                  try { window.dispatchEvent(new StorageEvent('storage', { key: 'map_user', newValue: null } as any)); } catch {}
                  try { window.dispatchEvent(new CustomEvent('map_user_changed', { detail: null })); } catch {}
                }}
                className="text-sm px-3 py-1 rounded-md border border-gray-200 bg-white text-black"
              >
                Sign out
              </button>

              {/* Clear data button intentionally removed; use URL param `?clear=true` to purge data once */}
            </div>
          </div>
        ) : (
          <Link href="/signin" className="text-sm px-3 py-1 rounded-md border border-gray-200 bg-white text-black font-semibold">Sign in</Link>
        )}
      </div>
    </nav>
  );
}
