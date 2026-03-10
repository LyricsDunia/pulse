
import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { QRCodeSVG } from "qrcode.react";

const SUPABASE_URL = "https://pjqwuamhlehiotkfolph.supabase.co";
const SUPABASE_KEY = "sb_publishable_azaiG_ix8j4oCIrJQEuvvA_wy_rOQJI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);


export default function PulseComplete() {
  const [view, setView] = useState("landing");
  const [myName, setMyName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [presence, setPresence] = useState({});
  const messagesEndRef = useRef(null);

  // 1. Initial URL Check
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const join = params.get("join");
    if (join) { setRoomCode(join.toUpperCase()); setView("join"); }
  }, []);

  // 2. The Realtime Sync Engine
  useEffect(() => {
    if (view !== "chat" || !roomCode) return;

    // Load initial messages
    const loadMessages = async () => {
      console.log("Fetching history for room:", roomCode);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_code', roomCode)
        .order('created_at', { ascending: true });
      
      if (error) console.error("History Error:", error);
      else setMessages(data || []);
    };
    loadMessages();

    // Subscribe to Realtime
    const channel = supabase.channel(`room_${roomCode}`, {
      config: { presence: { key: myName } }
    });

    channel
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `room_code=eq.${roomCode}` 
      }, (payload) => {
        console.log("New message received via Realtime:", payload.new);
        setMessages(curr => [...curr, payload.new]);
      })
      .on('presence', { event: 'sync' }, () => {
        setPresence(channel.presenceState());
      })
      .subscribe(async (status) => {
        console.log("Subscription status:", status);
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      console.log("Cleaning up channel...");
      supabase.removeChannel(channel);
    };
  }, [view, roomCode, myName]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // 3. Actions
  const handleCreate = async () => {
    if (!myName) return alert("Name required");
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await supabase.from('rooms').insert([{ code, owner_name: myName }]);
    if (error) alert("Create Room Error: " + error.message);
    else { setRoomCode(code); setView("chat"); }
  };

  const handleJoin = async () => {
    const { data } = await supabase.from('rooms').select('*').eq('code', roomCode).single();
    if (data) setView("chat");
    else alert("Room not found!");
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const content = input;
    setInput("");

    const { error } = await supabase.from('messages').insert([
      { room_code: roomCode, sender_name: myName, content }
    ]);
    if (error) console.error("Send Error:", error);
  };

  // 4. UI Rendering (Styles omitted for brevity, use your existing styles)
  if (view === "landing") return (
    <div style={styles.authBg}><div style={styles.authCard}>
      <h1 style={styles.logo}>⚡ PULSE</h1>
      <button style={styles.mainBtn} onClick={() => setView("create")}>Create Room</button>
      <button style={{...styles.mainBtn, background: '#1C2535', marginTop: '10px'}} onClick={() => setView("join")}>Join Room</button>
    </div></div>
  );

  if (view === "create" || view === "join") return (
    <div style={styles.authBg}><div style={styles.authCard}>
      <input style={styles.input} placeholder="Your Name" value={myName} onChange={e => setMyName(e.target.value)} />
      {view === "join" && <input style={styles.input} placeholder="Room Code" value={roomCode} onChange={e => setRoomCode(e.target.value)} />}
      <button style={styles.btn} onClick={view === "create" ? handleCreate : handleJoin}>Connect</button>
    </div></div>
  );

  const inviteLink = `${window.location.origin}${window.location.pathname}?join=${roomCode}`;

  return (
    <div style={styles.appFrame}>
      <div style={styles.sidebar}>
        <div style={styles.sideLabel}>INVITE</div>
        <QRCodeSVG value={inviteLink} size={120} bgColor="transparent" fgColor="#00FFD1" />
        <div style={{...styles.sideLabel, marginTop: '20px'}}>MEMBERS</div>
        {Object.keys(presence).map(u => <div key={u} style={{fontSize: '13px', marginBottom: '5px'}}>● {u}</div>)}
      </div>
      <div style={styles.main}>
        <header style={styles.header}>Room: {roomCode}</header>
        <div style={styles.msgArea}>
          {messages.map((m, i) => (
            <div key={i} style={m.sender_name === myName ? styles.myRow : styles.theirRow}>
              <div style={m.sender_name === myName ? styles.myBubble : styles.theirBubble}>
                <div style={{fontSize: '10px', color: '#00FFD1'}}>{m.sender_name}</div>
                {m.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={sendMessage} style={styles.footer}>
          <input style={styles.msgInput} value={input} onChange={e => setInput(e.target.value)} placeholder="Message..." />
          <button type="submit" style={styles.sendBtn}>➤</button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  authBg: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#07090D', fontFamily: 'sans-serif' },
  authCard: { background: '#0C1018', padding: '40px', borderRadius: '24px', border: '1px solid #1C2535', textAlign: 'center', width: '300px' },
  logo: { color: '#00FFD1', fontSize: '42px', marginBottom: '30px' },
  mainBtn: { width: '100%', padding: '15px', background: '#00FFD1', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' },
  input: { width: '100%', padding: '14px', marginBottom: '15px', background: '#111820', border: '1px solid #1C2535', borderRadius: '12px', color: '#fff', boxSizing: 'border-box' },
  btn: { width: '100%', padding: '14px', background: '#00FFD1', border: 'none', borderRadius: '12px', fontWeight: 'bold' },
  appFrame: { height: '100vh', display: 'flex', background: '#07090D', color: '#fff', fontFamily: 'sans-serif' },
  sidebar: { width: '200px', background: '#0C1018', borderRight: '1px solid #1C2535', padding: '20px' },
  sideLabel: { fontSize: '10px', color: '#6B8099', letterSpacing: '1px', marginBottom: '10px' },
  main: { flex: 1, display: 'flex', flexDirection: 'column' },
  header: { padding: '15px 25px', borderBottom: '1px solid #1C2535' },
  msgArea: { flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' },
  myRow: { alignSelf: 'flex-end' },
  theirRow: { alignSelf: 'flex-start' },
  myBubble: { background: 'rgba(0, 255, 209, 0.15)', padding: '10px 15px', borderRadius: '15px 15px 0 15px', border: '1px solid #00FFD1' },
  theirBubble: { background: '#111820', padding: '10px 15px', borderRadius: '15px 15px 15px 0', border: '1px solid #1C2535' },
  footer: { padding: '20px', display: 'flex', gap: '10px' },
  msgInput: { flex: 1, padding: '12px', background: '#111820', border: '1px solid #1C2535', borderRadius: '8px', color: '#fff', outline: 'none' },
  sendBtn: { background: '#00FFD1', border: 'none', padding: '0 20px', borderRadius: '8px', cursor: 'pointer' }
};