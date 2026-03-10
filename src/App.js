
import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { QRCodeSVG } from "qrcode.react";

const SUPABASE_URL = "https://pjqwuamhlehiotkfolph.supabase.co";
const SUPABASE_KEY = "sb_publishable_azaiG_ix8j4oCIrJQEuvvA_wy_rOQJI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function PulseGlobal() {
  const [view, setView] = useState("landing"); // landing, create, join, chat
  const [myName, setMyName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [presence, setPresence] = useState({});
  const channelRef = useRef(null);

  // ── 1. Handle URL Parameters (Invite Links) ─────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get("join");
    if (inviteCode) {
      setRoomCode(inviteCode);
      setView("join");
    }
  }, []);

  // ── 2. Room Logic ───────────────────────────────────────────────────────
  const createRoom = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await supabase.from('rooms').insert([{ code, created_by: myName }]);
    if (!error) {
      setRoomCode(code);
      setView("chat");
    }
  };

  const joinRoom = async () => {
    const { data } = await supabase.from('rooms').select('*').eq('code', roomCode).single();
    if (data) setView("chat");
    else alert("Room not found!");
  };

  // ── 3. Realtime Engine (Same as previous, optimized) ─────────────────────
  useEffect(() => {
    if (view !== "chat") return;

    const fetchHistory = async () => {
      const { data } = await supabase.from('messages').select('*').eq('room_code', roomCode).order('created_at', { ascending: true });
      if (data) setMessages(data);
    };
    fetchHistory();

    const channel = supabase.channel(`room_${roomCode}`, { config: { presence: { key: myName } } });
    channelRef.current = channel;

    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_code=eq.${roomCode}` }, 
        (p) => setMessages(curr => [...curr, p.new]))
      .on('presence', { event: 'sync' }, () => setPresence(channel.presenceState()))
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ online_at: new Date().toISOString() });
      });

    return () => { supabase.removeChannel(channel); };
  }, [view, roomCode, myName]);

  const inviteLink = `${window.location.origin}${window.location.pathname}?join=${roomCode}`;

  // ── 4. UI Views ──────────────────────────────────────────────────────────
  if (view === "landing") return (
    <div style={styles.authBg}>
      <div style={styles.authCard}>
        <h1 style={styles.logo}>⚡ PULSE</h1>
        <button style={styles.mainBtn} onClick={() => setView("create")}>Create New Room</button>
        <button style={{...styles.mainBtn, background: '#1C2535', marginTop: '10px'}} onClick={() => setView("join")}>Join with Code</button>
      </div>
    </div>
  );

  if (view === "create" || view === "join") return (
    <div style={styles.authBg}>
      <div style={styles.authCard}>
        <h2>{view === "create" ? "Start a Chat" : "Enter Room"}</h2>
        <input style={styles.input} placeholder="Your Name" onChange={e => setMyName(e.target.value)} />
        {view === "join" && <input style={styles.input} placeholder="Room Code" value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} />}
        <button style={styles.btn} onClick={view === "create" ? createRoom : joinRoom}>
          {view === "create" ? "Generate Room" : "Connect"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={styles.appFrame}>
      {/* Sidebar with Share Options */}
      <div style={styles.sidebar}>
        <div style={styles.sideLabel}>SHARE ROOM</div>
        <div style={styles.qrBox}>
          <QRCodeSVG value={inviteLink} size={120} bgColor="#0C1018" fgColor="#00FFD1" />
        </div>
        <button style={styles.copyBtn} onClick={() => navigator.clipboard.writeText(inviteLink)}>Copy Invite Link</button>
        
        <div style={{...styles.sideLabel, marginTop: '30px'}}>ONLINE</div>
        {Object.keys(presence).map(u => <div key={u} style={styles.userItem}>● {u}</div>)}
      </div>

      <div style={styles.main}>
        <header style={styles.header}>Room: <b>{roomCode}</b></header>
        <div style={styles.msgArea}>
          {messages.map((m, i) => (
            <div key={i} style={m.sender_name === myName ? styles.myRow : styles.theirRow}>
              <div style={m.sender_name === myName ? styles.myBubble : styles.theirBubble}>
                <div style={styles.sender}>{m.sender_name}</div>
                {m.content}
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if(input) { supabase.from('messages').insert([{room_code: roomCode, sender_name: myName, content: input}]); setInput(""); } }} style={styles.footer}>
          <input style={styles.msgInput} value={input} onChange={e => setInput(e.target.value)} placeholder="Type a message..." />
          <button type="submit" style={styles.sendBtn}>➤</button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  authBg: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#07090D', fontFamily: 'Inter, sans-serif' },
  authCard: { background: '#0C1018', padding: '40px', borderRadius: '24px', border: '1px solid #1C2535', textAlign: 'center', width: '320px' },
  logo: { color: '#00FFD1', fontSize: '42px', marginBottom: '30px' },
  mainBtn: { width: '100%', padding: '15px', background: '#00FFD1', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' },
  input: { width: '100%', padding: '12px', marginBottom: '10px', background: '#111820', border: '1px solid #1C2535', borderRadius: '8px', color: '#fff', boxSizing: 'border-box' },
  btn: { width: '100%', padding: '12px', background: '#00FFD1', border: 'none', borderRadius: '8px', fontWeight: 'bold' },
  appFrame: { height: '100vh', display: 'flex', background: '#07090D', color: '#fff', fontFamily: 'Inter, sans-serif' },
  sidebar: { width: '240px', background: '#0C1018', borderRight: '1px solid #1C2535', padding: '20px', display: 'flex', flexDirection: 'column' },
  sideLabel: { fontSize: '10px', color: '#6B8099', letterSpacing: '2px', marginBottom: '15px' },
  qrBox: { background: '#0C1018', padding: '10px', borderRadius: '12px', border: '1px solid #1C2535', display: 'flex', justifyContent: 'center', marginBottom: '15px' },
  copyBtn: { background: '#1C2535', color: '#00FFD1', border: '1px solid #00FFD1', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' },
  main: { flex: 1, display: 'flex', flexDirection: 'column' },
  header: { padding: '15px 25px', borderBottom: '1px solid #1C2535' },
  msgArea: { flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' },
  myRow: { alignSelf: 'flex-end' },
  theirRow: { alignSelf: 'flex-start' },
  myBubble: { background: 'rgba(0, 255, 209, 0.1)', padding: '10px 15px', borderRadius: '15px 15px 0 15px', border: '1px solid #00FFD1' },
  theirBubble: { background: '#111820', padding: '10px 15px', borderRadius: '15px 15px 15px 0', border: '1px solid #1C2535' },
  sender: { fontSize: '10px', color: '#00FFD1', marginBottom: '4px' },
  footer: { padding: '20px', display: 'flex', gap: '10px' },
  msgInput: { flex: 1, padding: '12px', background: '#111820', border: '1px solid #1C2535', borderRadius: '8px', color: '#fff' },
  sendBtn: { background: '#00FFD1', border: 'none', padding: '0 20px', borderRadius: '8px' }
};