(() => {
  function esc(s) {
    return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  const NAMES = ["cosmic","neon","solar","lunar","turbo","pixel","glitch","ghost","cyber","hyper"];
  const TAGS  = ["duck","shark","wolf","fox","cat","panda","rabbit","otter","lynx","crow"];
  function randName() {
    return NAMES[Math.random()*NAMES.length|0] + "_" + TAGS[Math.random()*TAGS.length|0];
  }

  let myName = localStorage.getItem("photon-chat-name") || randName();
  localStorage.setItem("photon-chat-name", myName);

  const style = document.createElement("style");
  style.textContent = `
    #ph-chat-btn {
      position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 9000;
      width: 50px; height: 50px; border-radius: 50%;
      background: #7c3aed; border: none;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(124,58,237,0.55);
      transition: transform 0.2s, box-shadow 0.2s;
      color: #fff;
    }
    #ph-chat-btn:hover { transform: scale(1.1); box-shadow: 0 6px 28px rgba(124,58,237,0.75); }
    #ph-chat-badge {
      position: absolute; top: -3px; right: -3px;
      background: #ef4444; color: #fff;
      font-size: 0.6rem; font-weight: 700;
      min-width: 17px; height: 17px; border-radius: 9px; padding: 0 3px;
      display: none; align-items: center; justify-content: center;
      font-family: 'Inter', sans-serif;
    }
    #ph-chat-panel {
      position: fixed; bottom: 5.75rem; right: 1.5rem; z-index: 9000;
      width: 300px; height: 420px;
      background: #1a1a2e; border: 1px solid rgba(120,80,255,0.18);
      border-radius: 14px;
      display: flex; flex-direction: column;
      box-shadow: 0 16px 56px rgba(0,0,0,0.5);
      overflow: hidden;
      transform: scale(0.93) translateY(10px);
      opacity: 0; pointer-events: none;
      transition: transform 0.2s cubic-bezier(0.4,0,0.2,1), opacity 0.2s;
    }
    #ph-chat-panel.open { transform: scale(1) translateY(0); opacity: 1; pointer-events: all; }
    .ph-chat-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.7rem 1rem;
      border-bottom: 1px solid rgba(120,80,255,0.18);
      font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 0.95rem;
      color: #a78bfa;
    }
    .ph-chat-header-left { display: flex; align-items: center; gap: 0.5rem; }
    .ph-online { font-size: 0.72rem; color: #555577; font-weight: 400; font-family: 'Inter', sans-serif; }
    .ph-chat-close {
      background: none; border: none; color: #8888aa;
      border-radius: 6px; padding: 0.15rem; display: flex; transition: color 0.15s, background 0.15s;
    }
    .ph-chat-close:hover { color: #e8e8f0; background: #1f1f38; }
    .ph-chat-msgs {
      flex: 1; overflow-y: auto; padding: 0.65rem 0.75rem;
      display: flex; flex-direction: column; gap: 0.35rem;
      scroll-behavior: smooth;
    }
    .ph-chat-msgs::-webkit-scrollbar { width: 3px; }
    .ph-chat-msgs::-webkit-scrollbar-thumb { background: rgba(120,80,255,0.25); border-radius: 2px; }
    .ph-msg { font-size: 0.82rem; line-height: 1.45; color: #e8e8f0; word-break: break-word; }
    .ph-msg-name { font-weight: 600; color: #a78bfa; margin-right: 0.3rem; }
    .ph-msg.mine .ph-msg-name { color: #c4b5fd; }
    .ph-sys {
      font-size: 0.73rem; color: #555577; text-align: center;
      font-style: italic; padding: 0.15rem 0;
    }
    .ph-chat-bottom {
      padding: 0.55rem 0.65rem; border-top: 1px solid rgba(120,80,255,0.18);
      display: flex; flex-direction: column; gap: 0.4rem;
    }
    .ph-name-row {
      display: flex; align-items: center; gap: 0.4rem;
      font-size: 0.73rem; color: #8888aa; font-family: 'Inter', sans-serif;
    }
    .ph-name-in {
      background: #141428; border: 1px solid rgba(120,80,255,0.18); border-radius: 6px;
      color: #e8e8f0; font-family: inherit; font-size: 0.75rem;
      padding: 0.18rem 0.5rem; width: 120px; outline: none;
      transition: border-color 0.15s;
    }
    .ph-name-in:focus { border-color: #7c3aed; }
    .ph-send-row { display: flex; gap: 0.4rem; }
    .ph-text-in {
      flex: 1; background: #141428; border: 1px solid rgba(120,80,255,0.18); border-radius: 8px;
      color: #e8e8f0; font-family: inherit; font-size: 0.83rem;
      padding: 0.38rem 0.6rem; outline: none; transition: border-color 0.15s;
    }
    .ph-text-in:focus { border-color: #7c3aed; }
    .ph-text-in::placeholder { color: #555577; }
    .ph-send-btn {
      background: #7c3aed; border: none; border-radius: 8px;
      color: #fff; font-family: inherit; font-size: 0.8rem; font-weight: 600;
      padding: 0.38rem 0.7rem; transition: background 0.15s; white-space: nowrap;
    }
    .ph-send-btn:hover { background: #6d28d9; }
  `;
  document.head.appendChild(style);

  const btn = document.createElement("button");
  btn.id = "ph-chat-btn";
  btn.title = "Chat";
  btn.innerHTML = `<span class="material-symbols-rounded" style="font-size:1.35rem">chat</span><span id="ph-chat-badge"></span>`;
  document.body.appendChild(btn);

  const panel = document.createElement("div");
  panel.id = "ph-chat-panel";
  panel.innerHTML = `
    <div class="ph-chat-header">
      <div class="ph-chat-header-left">
        <span>chat</span>
        <span class="ph-online" id="ph-online"></span>
      </div>
      <button class="ph-chat-close" id="ph-chat-close">
        <span class="material-symbols-rounded" style="font-size:1.05rem">close</span>
      </button>
    </div>
    <div class="ph-chat-msgs" id="ph-chat-msgs"><div class="ph-sys">connecting...</div></div>
    <div class="ph-chat-bottom">
      <div class="ph-name-row">
        name: <input class="ph-name-in" id="ph-name-in" maxlength="24" />
      </div>
      <div class="ph-send-row">
        <input class="ph-text-in" id="ph-text-in" placeholder="say something..." maxlength="500" />
        <button class="ph-send-btn" id="ph-send-btn">send</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  const badge    = document.getElementById("ph-chat-badge");
  const msgs     = document.getElementById("ph-chat-msgs");
  const nameIn   = document.getElementById("ph-name-in");
  const textIn   = document.getElementById("ph-text-in");
  const onlineEl = document.getElementById("ph-online");
  nameIn.value = myName;

  let open = false, unread = 0;

  function openPanel() {
    open = true; panel.classList.add("open");
    unread = 0; badge.style.display = "none";
    msgs.scrollTop = msgs.scrollHeight;
  }
  function closePanel() { open = false; panel.classList.remove("open"); }

  btn.addEventListener("click", () => open ? closePanel() : openPanel());
  document.getElementById("ph-chat-close").addEventListener("click", closePanel);

  nameIn.addEventListener("change", () => {
    myName = nameIn.value.trim() || myName;
    nameIn.value = myName;
    localStorage.setItem("photon-chat-name", myName);
  });

  function addMsg(msg, mine) {
    const first = msgs.querySelector(".ph-sys");
    if (first && first.textContent === "connecting...") first.remove();
    const el = document.createElement("div");
    el.className = "ph-msg" + (mine ? " mine" : "");
    el.innerHTML = `<span class="ph-msg-name">${esc(msg.name)}</span>${esc(msg.text)}`;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    if (!open) {
      unread++;
      badge.textContent = unread > 9 ? "9+" : unread;
      badge.style.display = "flex";
    }
  }

  function addSys(text) {
    const el = document.createElement("div");
    el.className = "ph-sys";
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  let onlineCount = 0;
  function setOnline(n) {
    onlineCount = n;
    onlineEl.textContent = n > 0 ? `${n} online` : "";
  }

  let es;
  function connect() {
    es = new EventSource("/api/chat/stream");
    es.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.type === "history") {
        msgs.innerHTML = "";
        if (d.messages.length === 0) addSys("no messages yet. say hi!");
        else d.messages.forEach(m => addMsg(m, m.name === myName));
      } else if (d.type === "online") {
        setOnline(d.count);
      } else {
        addMsg(d, d.name === myName);
      }
    };
    es.onerror = () => addSys("reconnecting...");
  }
  connect();

  async function send() {
    const text = textIn.value.trim();
    if (!text) return;
    textIn.value = "";
    myName = nameIn.value.trim() || myName;
    nameIn.value = myName;
    localStorage.setItem("photon-chat-name", myName);
    await fetch("/api/chat/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: myName, text }),
    }).catch(() => {});
  }

  document.getElementById("ph-send-btn").addEventListener("click", send);
  textIn.addEventListener("keydown", e => { if (e.key === "Enter") send(); });
})();
