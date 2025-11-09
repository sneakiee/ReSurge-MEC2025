"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignInPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [role, setRole] = useState<'support'|'need support'>('need support');

  useEffect(() => {
    try {
      const existing = localStorage.getItem('map_user');
      if (existing) setName(existing);
      const existingRole = localStorage.getItem('map_user_role');
      if (existingRole === 'support' || existingRole === 'need support') setRole(existingRole as 'support'|'need support');
    } catch {}
  }, []);

  const save = () => {
    const n = (name || '').trim() || 'Anonymous';
    try { localStorage.setItem('map_user', n); } catch {}
    try { localStorage.setItem('map_user_role', role); } catch {}
    // notify other components in the same window (storage events don't fire in same window)
    try { window.dispatchEvent(new CustomEvent('map_user_changed', { detail: { name: n, role } })); } catch {}
    // go back if possible
    try { router.back(); } catch { router.push('/'); }
  };

  const cancel = () => {
    try { router.back(); } catch { router.push('/'); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-gradient-to-b from-[#f4f6f8] to-[#eef2f6]">
      <div className="w-[520px] max-w-full bg-white p-7 rounded-xl shadow-[0_10px_40px_rgba(11,103,255,0.06)] border border-[rgba(0,0,0,0.04)]">
        <h1 className="mt-0 mb-1 text-[28px] text-[#071130] leading-[1.15] font-semibold">Sign In</h1>
        <p className="mt-0 text-[#253244] leading-7 text-[16px]">Sign in with a username to post. Your display name will appear next to your posts on the map.</p>

        <label htmlFor="displayName" className="block mt-4 mb-2 text-[#0f172a] font-bold text-[15px]">Display name</label>
        <input
          id="displayName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your Display Name"
          className="w-full px-4 py-3 rounded-lg border border-[#cbd5e1] text-[17px] text-[#0f172a] box-border"
        />

        <label htmlFor="role" className="block mt-4 mb-2 text-[#0f172a] font-bold text-[15px]">Role</label>
        <select id="role" value={role} onChange={(e) => setRole(e.target.value as any)} className="w-full px-4 py-3 rounded-lg border border-[#cbd5e1] text-[17px] text-[#0f172a] box-border">
          <option value="need support">Need support</option>
          <option value="support">Support</option>
        </select>

        <div className="mt-4 flex gap-3 justify-end">
          <button onClick={cancel} className="px-4 py-2 rounded-lg bg-white border border-[#e2e8f0] text-[#0f172a] font-medium">Cancel</button>
          <button onClick={save} className="px-4 py-2 rounded-lg bg-[#0b67ff] text-white font-extrabold">Save</button>
        </div>
      </div>
    </div>
  );
}
