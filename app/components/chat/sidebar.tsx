"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Message = { id: string; from: string; to: string; text: string; createdAt: number };

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem('map_messages');
    if (!raw) return [];
    return JSON.parse(raw) as Message[];
  } catch {
    return [];
  }
}

function saveMessages(msgs: Message[]) {
  try { localStorage.setItem('map_messages', JSON.stringify(msgs)); } catch {}
}

export default function ChatSidebar() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [pinCounts, setPinCounts] = useState<Record<string, number>>({});

  useEffect(() => { setMessages(loadMessages()); }, []);

  // track current user from localStorage and storage events so UI updates when user signs in/out
  useEffect(() => {
    const read = () => {
      try { setCurrentUser(localStorage.getItem('map_user')); } catch { setCurrentUser(null); }
    };
    read();
    const loadPins = () => {
      try {
        const raw = localStorage.getItem('map_pins');
        if (!raw) { setPinCounts({}); return; }
        const pins = JSON.parse(raw) as any[];
        const counts: Record<string, number> = {};
        pins.forEach((p) => { (p.posts || []).forEach((pp: any) => { const name = pp.author || 'Anonymous'; counts[name] = (counts[name] || 0) + 1; }); });
        setPinCounts(counts);
      } catch { setPinCounts({}); }
    };
    loadPins();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'map_user' || e.key === 'map_messages' || e.key === 'map_pins') read();
      if (e.key === 'map_messages') setMessages(loadMessages());
      if (e.key === 'map_pins') loadPins();
    };
    const onCustom = (e: any) => {
      // custom event for same-window changes
      read();
      setMessages(loadMessages());
      // reload pins for same-window updates
      try { const raw = localStorage.getItem('map_pins'); if (raw) { const pins = JSON.parse(raw) as any[]; const counts: Record<string, number> = {}; pins.forEach((p) => { (p.posts || []).forEach((pp: any) => { const name = pp.author || 'Anonymous'; counts[name] = (counts[name] || 0) + 1; }); }); setPinCounts(counts); } else setPinCounts({}); } catch { setPinCounts({}); }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('map_user_changed', onCustom as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('map_user_changed', onCustom as EventListener);
    };
  }, []);

  // gather usernames from messages and pins and compute message/pin counts
  const usersInfo = useMemo(() => {
    const map = new Map<string, { name: string; msgCount: number; pinCount: number }>();
    messages.forEach((m) => {
      map.set(m.from, { name: m.from, msgCount: (map.get(m.from)?.msgCount || 0) + 1, pinCount: map.get(m.from)?.pinCount || 0 });
      map.set(m.to, { name: m.to, msgCount: (map.get(m.to)?.msgCount || 0) + 1, pinCount: map.get(m.to)?.pinCount || 0 });
    });
    // merge in pin counts computed in effect (client-only)
    Object.entries(pinCounts).forEach(([name, cnt]) => {
      const cur = map.get(name) || { name, msgCount: 0, pinCount: 0 };
      cur.pinCount = (cur.pinCount || 0) + cnt;
      map.set(name, cur);
    });
    return Array.from(map.values()).filter(u => u.name).sort((a,b) => a.name.localeCompare(b.name));
  }, [messages, pinCounts]);

  const filteredUsers = usersInfo.filter((u) => u.name.toLowerCase().includes(query.toLowerCase()));

  const conv = useMemo(() => {
    if (!selectedUser) return [] as Message[];
    return messages.filter((m) => (m.from === selectedUser && m.to === currentUser) || (m.from === currentUser && m.to === selectedUser)).sort((a,b) => a.createdAt - b.createdAt);
  }, [messages, selectedUser, currentUser]);

  function sendMessage() {
  if (!currentUser) { router.push('/signin'); return; }
    if (!selectedUser || !draft.trim()) return;
    const msg: Message = { id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, from: currentUser, to: selectedUser, text: draft.trim(), createdAt: Date.now() };
    const next = [...messages, msg];
    setMessages(next); saveMessages(next); setDraft('');
  }

  return (
    <aside className="w-80 h-[calc(100vh-64px)] border-r border-gray-200 bg-white flex flex-col text-black">
      <div className="p-4 border-b">
        <div className="text-base font-semibold text-black">Chat</div>
        <div className="mt-3">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search user" className="w-full px-3 py-2 border rounded text-sm bg-gray-50" />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-2">
          {filteredUsers.length === 0 && (<div className="text-sm text-gray-500">No users found</div>)}
          {filteredUsers.map((u) => (
            <div key={u.name} onClick={() => setSelectedUser(u.name)} className={`p-3 rounded hover:bg-gray-50 cursor-pointer ${selectedUser === u.name ? 'bg-gray-100' : ''}`}>
              <div className="flex justify-between items-center">
                <div className="font-medium text-sm text-black">{u.name}</div>
              </div>
              <div className="text-xs text-gray-500 mt-1">{u.pinCount} pins</div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 border-t">
        {selectedUser ? (
          <div>
            <div className="text-base font-semibold">Conversation with {selectedUser}</div>
            <div className="max-h-44 overflow-auto mt-3 mb-3 bg-white p-2 rounded border">
              {conv.length === 0 && <div className="text-sm text-gray-500">No messages yet</div>}
              {conv.map((m) => (
                <div key={m.id} className={`mb-3 ${m.from === currentUser ? 'text-right' : ''}`}>
                  <div className="text-xs text-gray-500">{m.from} • {new Date(m.createdAt).toISOString()}</div>
                  <div className="text-sm bg-gray-50 inline-block p-2 rounded border mt-1 text-black">{m.text}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} className="flex-1 px-2 py-1 border rounded" placeholder="Message..." />
              <button onClick={sendMessage} className="px-3 py-1 bg-blue-600 text-white rounded">Send</button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">Select a user to view conversation</div>
        )}
      </div>
    </aside>
  );
}
