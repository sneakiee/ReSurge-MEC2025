"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type * as L from 'leaflet';

// Single clean component - replaces previous corrupted content.
export default function InteractiveCountryMap() {
  const mapRef = useRef<L.Map | null>(null);
  const [overlayPos, setOverlayPos] = useState<{ x: number; y: number } | null>(null);

  type Post = { id: string; title: string; body?: string; createdAt: number; author?: string };
  type Pin = { id: string; lat: number; lng: number; posts: Post[]; createdAt: number };

  const [pins, setPins] = useState<Pin[]>([]);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const router = useRouter();
  const [mapZoom, setMapZoom] = useState<number>(2);

  const [creatingPin, setCreatingPin] = useState<{ lat: number; lng: number } | null>(null);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formBody, setFormBody] = useState<string>('');
  const [newPostTitle, setNewPostTitle] = useState<string>('');
  const [newPostBody, setNewPostBody] = useState<string>('');

  // Dynamically load react-leaflet + leaflet on the client only to avoid server-side
  // evaluation of browser-only globals (window) during Next pre-render.
  const [RL, setRL] = useState<any | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (async () => {
      const [rl, Lm] = await Promise.all([import('react-leaflet'), import('leaflet')]);
      setRL({ ...rl, L: (Lm && (Lm.default || Lm)) });
    })();
  }, []);

  // Load persisted pins and username from localStorage (client-only)
  useEffect(() => {
    try { const storedUser = localStorage.getItem('map_user'); if (storedUser) setUsername(storedUser); } catch {}
    try {
      const raw = localStorage.getItem('map_pins');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const migrated: Pin[] = parsed.map((p: any) => {
            if (Array.isArray(p.posts)) return { id: p.id, lat: p.lat, lng: p.lng, posts: p.posts.map((pp: any) => ({ id: pp.id || `${pp.createdAt}-${Math.random().toString(36).slice(2,8)}`, title: pp.title || '', body: pp.body || '', createdAt: pp.createdAt || Date.now(), author: pp.author || (localStorage.getItem('map_user') || 'Anonymous') })), createdAt: p.createdAt || Date.now() };
            const posts: Post[] = [];
            if (p.title || p.body) posts.push({ id: `${p.createdAt || Date.now()}-${Math.random().toString(36).slice(2,8)}`, title: p.title || 'Untitled', body: p.body || '', createdAt: p.createdAt || Date.now(), author: localStorage.getItem('map_user') || 'Anonymous' });
            return { id: p.id || `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, lat: p.lat, lng: p.lng, posts, createdAt: p.createdAt || Date.now() };
          });
          setPins(migrated); try { localStorage.setItem('map_pins', JSON.stringify(migrated)); } catch {}
        }
      }
    } catch (e) { }
  }, []);

  useEffect(() => {
    const map = mapRef.current; if (!map || !selectedPin) return;
    const update = () => { const point = map.latLngToContainerPoint([selectedPin.lat, selectedPin.lng]); setOverlayPos({ x: point.x, y: point.y }); };
    map.on('move zoom', update);
    update();
    return () => { map.off('move zoom', update); };
  }, [selectedPin]);

  // While react-leaflet isn't loaded show a placeholder. After RL is
  // available we can safely use its hooks and components (browser-only).
  if (!RL) {
    return <div className="h-[calc(100vh-64px)]" />;
  }

  const MapRefSetter = function MapRefSetterInner() {
    const map = RL.useMap();
    useEffect(() => {
      mapRef.current = map;
      setMapZoom(map.getZoom());
      const onZoom = () => setMapZoom(map.getZoom());
      map.on('zoomend', onZoom);
      return () => { map.off('zoomend', onZoom); if (mapRef.current === map) mapRef.current = null; };
    }, [map]);
    return null;
  };

  const MapClickHandler = function MapClickHandlerInner() {
    RL.useMapEvent('click', (e: any) => {
      const orig = e?.originalEvent as any;
      try {
        const targ: HTMLElement | null = orig && orig.target ? orig.target : null;
        if (targ && (targ.classList?.contains('leaflet-interactive') || targ.closest?.('.leaflet-interactive'))) return;
      } catch {}
      if (!username) { router.push('/signin'); return; }
      const lat = e.latlng.lat; const lng = e.latlng.lng;
      setCreatingPin({ lat, lng }); setSelectedPin(null); setFormTitle(''); setFormBody('');
      if (mapRef.current) { const pt = mapRef.current.latLngToContainerPoint([lat, lng]); setOverlayPos({ x: pt.x, y: pt.y }); }
    });
    return null;
  };

      const persistPins = (next: typeof pins) => { try { localStorage.setItem('map_pins', JSON.stringify(next)); } catch {} };

      const haversineMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
        const toRad = (v: number) => (v * Math.PI) / 180; const R = 6371000; const dLat = toRad(b.lat - a.lat); const dLon = toRad(b.lng - a.lng); const lat1 = toRad(a.lat); const lat2 = toRad(b.lat); const sinDlat = Math.sin(dLat / 2); const sinDlon = Math.sin(dLon / 2); const aa = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon; const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa)); return R * c;
      };

      const computeClusters = (items: typeof pins) => {
        const thresholdMeters = 800; const maxClusterSize = 8; const used = new Set<string>(); const clusters: Array<{ ids: string[]; lat: number; lng: number; pins: Pin[] }> = [];
        for (let i = 0; i < items.length; i++) {
          const p = items[i]; if (used.has(p.id)) continue; const queue = [p]; const clusterPins: Pin[] = []; used.add(p.id);
          while (queue.length > 0 && clusterPins.length < maxClusterSize) {
            const cur = queue.shift()!; clusterPins.push(cur);
            for (let j = 0; j < items.length; j++) { const other = items[j]; if (used.has(other.id)) continue; const d = haversineMeters({ lat: cur.lat, lng: cur.lng }, { lat: other.lat, lng: other.lng }); if (d <= thresholdMeters && clusterPins.length < maxClusterSize) { used.add(other.id); queue.push(other); } }
          }
          if (clusterPins.length === 1) clusters.push({ ids: [p.id], lat: p.lat, lng: p.lng, pins: clusterPins }); else { const avgLat = clusterPins.reduce((s, x) => s + x.lat, 0) / clusterPins.length; const avgLng = clusterPins.reduce((s, x) => s + x.lng, 0) / clusterPins.length; clusters.push({ ids: clusterPins.map((c) => c.id), lat: avgLat, lng: avgLng, pins: clusterPins }); }
        }
        return clusters;
      };

      return (
        <div className="relative h-full">
          <RL.MapContainer center={[20, 0]} zoom={2} style={{ height: 'calc(100vh - 64px)', width: '100%' }} maxBounds={[[ -90, -180], [90, 180 ]]} maxBoundsViscosity={1}>
            <RL.TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" noWrap={true} />
            <MapRefSetter />
            <MapClickHandler />

            {computeClusters(pins).map((cluster) => {
              const clusterSize = cluster.pins.length;
              const radius = Math.max(14, Math.min(28, Math.round((mapZoom - 1) * 3 + 12)));
              const clusterRadius = clusterSize > 1 ? radius + Math.min(20, clusterSize * 3) : radius;
              const hitRadius = clusterRadius + 14;

              if (clusterSize === 1) {
                const pin = cluster.pins[0];
                return (
                  <>
                    <RL.CircleMarker key={`${pin.id}-hit`} center={[pin.lat, pin.lng]} radius={hitRadius} pathOptions={{ opacity: 0.01, fillOpacity: 0.01 }} eventHandlers={{ click: () => { setSelectedPin(pin); setCreatingPin(null); setFormTitle(''); setFormBody(''); setNewPostTitle(''); setNewPostBody(''); if (mapRef.current) { const pt = mapRef.current.latLngToContainerPoint([pin.lat, pin.lng]); setOverlayPos({ x: pt.x, y: pt.y }); } } }} />
                    <RL.CircleMarker key={pin.id} center={[pin.lat, pin.lng]} radius={radius} pathOptions={{ color: '#c00', fillColor: '#c00', fillOpacity: 0.95, weight: 1 }} eventHandlers={{ mouseover: (e: any) => { const layer = e.target; layer.setStyle({ weight: 2 }); }, mouseout: (e: any) => { const layer = e.target; layer.setStyle({ weight: 1 }); }, click: () => { setSelectedPin(pin); setCreatingPin(null); setFormTitle(''); setFormBody(''); setNewPostTitle(''); setNewPostBody(''); if (mapRef.current) { const pt = mapRef.current.latLngToContainerPoint([pin.lat, pin.lng]); setOverlayPos({ x: pt.x, y: pt.y }); } } }} />
                  </>
                );
              }

              return (
                <>
                  <RL.CircleMarker key={`${cluster.ids.join('-')}-hit`} center={[cluster.lat, cluster.lng]} radius={hitRadius} pathOptions={{ opacity: 0.01, fillOpacity: 0.01 }} eventHandlers={{ click: () => { const combinedPosts: Post[] = []; cluster.pins.forEach((pp) => combinedPosts.push(...pp.posts)); const virtual: Pin = { id: `cluster-${cluster.ids.join('-')}`, lat: cluster.lat, lng: cluster.lng, posts: combinedPosts, createdAt: Date.now() }; setSelectedPin(virtual); setCreatingPin(null); if (mapRef.current) { const pt = mapRef.current.latLngToContainerPoint([cluster.lat, cluster.lng]); setOverlayPos({ x: pt.x, y: pt.y }); } } }} />
                  <RL.CircleMarker key={`cluster-${cluster.ids.join('-')}`} center={[cluster.lat, cluster.lng]} radius={clusterRadius} pathOptions={{ color: '#4b0082', fillColor: '#7b3fbf', fillOpacity: 0.9, weight: 1 }}>
                    <RL.Tooltip permanent direction="center" className="text-sm font-semibold">{clusterSize}</RL.Tooltip>
                  </RL.CircleMarker>
                </>
              );
            })}
          </RL.MapContainer>

          {/* Clear pins button removed per request */}

          {(selectedPin || creatingPin) && overlayPos && (
            <div className="absolute bg-white text-black p-2 rounded-md shadow-md pointer-events-auto z-[1000] w-[260px]" style={{ left: Math.max(8, overlayPos.x - 260), top: Math.max(8, overlayPos.y - 60) }}>
              {creatingPin ? (
                <form onSubmit={(e) => { e.preventDefault(); if (!username) { router.push('/signin'); return; } const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; const posts: Post[] = []; if (formTitle || formBody) posts.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, title: formTitle || 'Untitled', body: formBody || '', createdAt: Date.now(), author: username }); const newPin: Pin = { id, lat: creatingPin.lat, lng: creatingPin.lng, posts, createdAt: Date.now() }; setPins((p) => { const next = [...p, newPin]; persistPins(next); return next; }); setSelectedPin(newPin); setCreatingPin(null); setFormTitle(''); setFormBody(''); }}>
                  <div className="mb-2"><input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Post title (optional)" className="w-full box-border text-black bg-white border border-gray-300 px-2 py-1 rounded" /></div>
                  <div className="mb-2"><textarea value={formBody} onChange={(e) => setFormBody(e.target.value)} placeholder="Write your post..." rows={4} className="w-full box-border text-black bg-white border border-gray-300 px-2 py-1 rounded" /></div>
                  <div className="flex gap-2 justify-end"><button type="submit" className="px-3 py-1 rounded bg-blue-600 text-white font-semibold">Create pin</button><button type="button" onClick={() => { setCreatingPin(null); setOverlayPos(null); }} className="px-3 py-1 rounded bg-white border">Cancel</button></div>
                </form>
              ) : selectedPin ? (
                <div>
                  <div className="mb-2 font-bold text-[15px]">Posts</div>
                  <div className="max-h-[160px] overflow-auto mb-2">
                    {selectedPin.posts.length === 0 && <div className="text-gray-500 mb-1">No posts yet — add one below.</div>}
                    {selectedPin.posts.map((post) => (
                      <div key={post.id} className="mb-2 p-2 rounded-lg bg-[#fafafa] text-black border border-gray-100">
                        <div className="font-bold text-[15px] text-[#071130]">{post.title || 'Untitled'}</div>
                        <div className="text-[12px] text-gray-500 mt-1">by {post.author || 'Anonymous'}</div>
                        <div className="text-[14px] text-[#222] whitespace-pre-wrap mt-2">{post.body}</div>
                        <div className="mt-2 flex justify-between gap-2">
                          <div className="text-[11px] text-gray-500">{new Date(post.createdAt).toISOString()}</div>
                              {post.author === username ? (<button onClick={() => { if (post.author !== username) return; setPins((p) => { const next = p.map((pin) => pin.id === selectedPin!.id ? { ...pin, posts: pin.posts.filter((pp) => pp.id !== post.id) } : pin); persistPins(next); return next; }); setSelectedPin((cur) => { if (!cur) return cur; return { ...cur, posts: cur.posts.filter((pp) => pp.id !== post.id) }; }); }} className="text-sm text-red-600">Delete post</button>) : null}
                                </div>
                      </div>
                    ))}
                  </div>

                  <div className="mb-2 font-bold text-[15px]">Add post</div>
                  <div className="mb-2"><input value={newPostTitle} onChange={(e) => setNewPostTitle(e.target.value)} placeholder="Post title (optional)" className="w-full box-border text-[#0f172a] bg-white border border-gray-300 px-2 py-1 text-sm rounded" /></div>
                  <div className="mb-2"><textarea value={newPostBody} onChange={(e) => setNewPostBody(e.target.value)} placeholder="Write your post..." rows={3} className="w-full box-border text-[#0f172a] bg-white border border-gray-300 px-2 py-1 text-sm rounded" /></div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { if (!username) { router.push('/signin'); return; } if (!selectedPin) return; const post: Post = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, title: newPostTitle || 'Untitled', body: newPostBody || '', createdAt: Date.now(), author: username }; setPins((p) => { const next = p.map((pin) => pin.id === selectedPin.id ? { ...pin, posts: [...pin.posts, post] } : pin); persistPins(next); return next; }); setSelectedPin((cur) => cur ? { ...cur, posts: [...cur.posts, post] } : cur); setNewPostTitle(''); setNewPostBody(''); }} className="px-3 py-1 rounded bg-blue-600 text-white font-semibold">Add post</button>
                    {username && selectedPin && selectedPin.posts.length > 0 && selectedPin.posts.every((pp) => pp.author === username) ? (<button onClick={() => { if (!selectedPin) return; if (!username) return; if (!selectedPin.posts.every((pp) => pp.author === username)) return; setPins((p) => { const next = p.filter((x) => x.id !== selectedPin.id); persistPins(next); return next; }); setSelectedPin(null); setOverlayPos(null); }} className="px-3 py-1 rounded bg-white border text-red-600">Delete pin</button>) : null}
                    <button onClick={() => { setSelectedPin(null); setOverlayPos(null); }} className="px-3 py-1 rounded bg-white border">Close</button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
  );
}
