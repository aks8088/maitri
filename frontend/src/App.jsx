import { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import {
  Rocket,
  Brain,
  MessageCircle,
  Activity,
  LogOut,
  Moon,
  Sparkles,
  User,
  Heart,
  Wind,
  Compass,
  Target,
  Timer,
} from "lucide-react";
import "./App.css";

const API_BASE = "http://127.0.0.1:8000";

function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user")));
  const [page, setPage] = useState(user ? "dashboard" : "home");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [activeSection, setActiveSection] = useState("dashboard");

  const [moods, setMoods] = useState([]);
  const [mood, setMood] = useState("");
  const [stress, setStress] = useState(5);
  const [sleep, setSleep] = useState(7);

  const [summary, setSummary] = useState("");
  const [tip, setTip] = useState("");

  const [chatInput, setChatInput] = useState("");
  const [chatResponse, setChatResponse] = useState("");

  const [status, setStatus] = useState("🛰️ Offline-ready environment...");
  const [showProfile, setShowProfile] = useState(false);

  // ---------- AUTH ----------
  async function handleAuth(endpoint) {
    try {
      const form = new FormData();
      form.append("username", username);
      form.append("password", password);
      const res = await axios.post(`${API_BASE}/${endpoint}`, form);
      const newUser = { username, user_id: res.data.user_id };
      localStorage.setItem("user", JSON.stringify(newUser));
      setUser(newUser);
      setPage("dashboard");
    } catch (err) {
      alert(err.response?.data?.detail || "Authentication failed");
    }
  }

  function logout() {
    localStorage.removeItem("user");
    setUser(null);
    setPage("home");
  }

  // ---------- DATA ----------
  useEffect(() => {
    if (user && page === "dashboard") {
      fetchMoods();
      fetchSummary();
      fetchTip();
    }
  }, [user, page]);

  async function fetchMoods() {
    try {
      const res = await axios.get(`${API_BASE}/moods?user_id=${user.user_id}`);
      const formatted = res.data.map((m) => ({
        ...m,
        // normalize date for charts
        date: m.date ? m.date.split("T")[0] : new Date().toISOString().split("T")[0],
        // guard numeric fields
        stress_level: Number.isFinite(m.stress_level) ? m.stress_level : 0,
        sleep_hours: Number.isFinite(m.sleep_hours) ? m.sleep_hours : 0,
        // normalize any odd mood tokens
        mood: (m.mood || "").trim().toLowerCase() === "amit" ? "neutral" : (m.mood || "neutral"),
      }));
      setMoods(formatted);
      setStatus("Connected to backend");
    } catch {
      setStatus(" Offline mode");
    }
  }

  async function fetchSummary() {
    try {
      const res = await axios.get(`${API_BASE}/weekly_summary?user_id=${user.user_id}`);
      setSummary(res.data.summary);
    } catch {
      setSummary("No summary available.");
    }
  }

  async function fetchTip() {
    try {
      const res = await axios.get(`${API_BASE}/wellness_tip?user_id=${user.user_id}`);
      setTip(res.data.tip);
    } catch {
      setTip("No tip available.");
    }
  }

  async function submitMood() {
    if (!mood) return alert("Please enter your mood!");
    await axios.post(`${API_BASE}/moods`, {
      mood,
      stress_level: parseInt(stress),
      sleep_hours: parseFloat(sleep),
      user_id: user.user_id,
    });
    setMood("");
    fetchMoods();
    fetchSummary();
    fetchTip();
  }

  async function sendChat() {
    if (!chatInput.trim()) return;
    try {
      const res = await axios.post(`${API_BASE}/chatbot`, { message: chatInput });
      setChatResponse(res.data.reply);
    } catch {
      setChatResponse(" Offline: Express how you feel — I’m listening.");
    }
    setChatInput("");
  }

  // gentle movement reminder (kept)
  useEffect(() => {
    const reminder = setInterval(() => {
      // non-blocking hint: keep, or comment if you prefer
      // alert("🧘 Take a short stretch break! Even zero gravity needs movement!");
      console.log("Stretch reminder");
    }, 7200000);
    return () => clearInterval(reminder);
  }, []);

  // ---------- HOME ----------
  if (page === "home") {
    return (
      <div className="home-container">
        {/* animated starfield */}
        <div className="stars stars-a" />
        <div className="stars stars-b" />
        <div className="stars stars-c" />

        <div className="astronaut-float"></div>

        {/* glowing MAITRI caption */}
        <motion.div
          className="home-content"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="glow-title">
            <span className="brand">MAITRI</span>
            <span className="tagline">— a mental wellness app for astronauts —</span>
          </div>
          <div className="auth-buttons">
            <button onClick={() => setPage("login")}>Login</button>
            <button onClick={() => setPage("signup")}>Sign Up</button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ---------- LOGIN/SIGNUP ----------
  if (page === "login" || page === "signup") {
    return (
      <div className="auth-screen">
        <motion.div className="auth-box" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
          <Moon className="icon" />
          <h2>{page === "login" ? "Welcome Astronaut" : "Join the Crew"}</h2>
          <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={() => handleAuth(page)}>{page === "login" ? "Login" : "Signup"}</button>
          <p>
            {page === "login" ? (
              <>New user? <span className="linkish" onClick={() => setPage("signup")}>Sign up</span></>
            ) : (
              <>Already a member? <span className="linkish" onClick={() => setPage("login")}>Login</span></>
            )}
          </p>
        </motion.div>
      </div>
    );
  }

  // ---------- DASHBOARD ----------
  const moodPalette = ["#3b82f6", "#22c55e", "#facc15", "#f87171", "#a855f7", "#06b6d4", "#ef4444", "#10b981"];

  // build mood distribution (with "amit" → "neutral")
  const moodCounts = moods.reduce((acc, m) => {
    const name = (m.mood || "neutral").trim().toLowerCase() === "amit" ? "neutral" : (m.mood || "neutral");
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(moodCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // creative labels / sections
  const NAV = [
    { key: "dashboard", label: "Mission log" },        // (was Dashboard)
    { key: "analytics", label: "Cos-metrics" },              // (was Analytics)
    { key: "remedies", label: "Cosmic Remedies" },         // (was Remedies)
    { key: "guidance", label: " Do's and Dont's" },            // (was Guidance)
    { key: "drills", label: "Excercises" },            // NEW: exercise hub
    { key: "chatbot", label: "AI powered chatbot assistance" },               // (was AI Chatbot)
  ];

  return (
    <div className="dashboard-layout">
      <div className="stars stars-a" />
      <div className="stars stars-b" />
      <div className="stars stars-c" />

      {/* NAVBAR */}
      <header className="navbar glass">
        <h1 className="app-title flex items-center gap-2 text-blue-300 text-xl font-semibold">
          <Rocket size={18} /> Maitri Dashboard
        </h1>
        <div className="relative">
          <User
            className="profile-icon cursor-pointer text-blue-300 hover:text-blue-400 w-7 h-7"
            onClick={() => setShowProfile(!showProfile)}
          />
          {showProfile && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="dropdown"
            >
              <p className="dropdown-user">{user?.username}</p>
              <button className="dropdown-item">View Profile</button>
              <button onClick={logout} className="dropdown-logout">
                <LogOut size={16} /> Logout
              </button>
            </motion.div>
          )}
        </div>
      </header>

      {/* FEATURE BAR (creative names) */}
      <nav className="horizontal-nav glass">
        {NAV.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={activeSection === key ? "active" : ""}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <div className="status">{status}</div>

        <AnimatePresence mode="wait">
          {/* Command Center (Dashboard) */}
          {activeSection === "dashboard" && (
            <motion.section className="section glass" key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2><Activity className="inline" /> Log Your Mood</h2>
              <div className="inputs">
                <input placeholder="Mood" value={mood} onChange={(e) => setMood(e.target.value)} />
                <input type="number" placeholder="Stress 0–10" value={stress} onChange={(e) => setStress(e.target.value)} />
                <input type="number" placeholder="Sleep (hours)" value={sleep} onChange={(e) => setSleep(e.target.value)} />
              </div>
              <button onClick={submitMood}>Save Entry</button>
            </motion.section>
          )}

          {/* Telemetry (Analytics) */}
          {activeSection === "analytics" && (
            <motion.section
              className="section glass"
              key="analytics"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-blue-300 text-xl mb-2 flex items-center gap-2">
                <Brain /> Mission Analytics Overview
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Stress (line, 0–10 step 1) */}
                <div className="chart-card">
                  <h3 className="chart-title">Stress Trend</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={moods.slice().reverse()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 10]} ticks={[...Array(11).keys()]} />
                      <Tooltip contentStyle={{ background: "#0f172a", borderRadius: "10px" }} />
                      <Legend />
                      <Line type="monotone" dataKey="stress_level" stroke="#fb7185" strokeWidth={3} dot={{ fill: "#fb7185" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Sleep (bar, 0–10 step 1) */}
                <div className="chart-card">
                  <h3 className="chart-title">💤 Sleep Analytics</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={moods.slice().reverse()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 10]} ticks={[...Array(11).keys()]} />
                      <Tooltip contentStyle={{ background: "#0f172a", borderRadius: "10px" }} />
                      <Legend />
                      <Bar dataKey="sleep_hours" fill="#38bdf8" barSize={28} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Mood Composition pie */}
              <div className="chart-card mt-6">
                <h3 className="chart-title"> Mood Composition</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={moodPalette[i % moodPalette.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1e293b", borderRadius: "10px" }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="summary-box mt-6">
                <Sparkles className="inline text-yellow-300 mr-2" />
                {summary || "Your weekly mission report will appear here after mood logging."}
              </div>
            </motion.section>
          )}

          {/* Cosmic Remedies (Remedies) */}
          {activeSection === "remedies" && (
            <motion.section className="section glass" key="remedies" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2><Sparkles className="inline text-yellow-300" /> Cosmic Remedies</h2>
              <ul className="list-disc mt-3 ml-5 space-y-1">
                <li> 2 minutes of slow box breathing (4–4–4–4).</li>
                <li> Guided micro-meditation before sleep.</li>
                <li> Hydrate; avoid caffeine after 18:00 ship time.</li>
                <li> Ambient “space hum” for focus (15 min).</li>
              </ul>
              <p className="mt-4 hint">{tip}</p>
            </motion.section>
          )}

          {/* Crew Support (Guidance) */}
          {activeSection === "guidance" && (
            <motion.section className="section glass" key="guidance" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2><Heart className="inline text-pink-400" /> Crew Support</h2>
              <div className="grid md:grid-cols-2 gap-6 mt-4">
                <div className="card glass p-5 rounded-xl shadow-lg border border-green-500/30">
                  <h3 className="text-green-400 mb-3 text-lg font-semibold"> Do’s</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Hydrate and stretch every 2–3 hours.</li>
                    <li>Share check-ins with crewmates.</li>
                    <li>Journal brief emotions at lights out.</li>
                  </ul>
                </div>
                <div className="card glass p-5 rounded-xl shadow-lg border border-red-500/30">
                  <h3 className="text-red-400 mb-3 text-lg font-semibold">Don’ts</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Ignore mental fatigue signals.</li>
                    <li>Skip meals or disturb sleep rhythm.</li>
                    <li>Overanalyze minor mission dips.</li>
                  </ul>
                </div>
              </div>
            </motion.section>
          )}

          {/* Mission Drills (Exercise Hub) */}
          {activeSection === "drills" && (
            <motion.section className="section glass" key="drills" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-blue-300 flex items-center gap-2">
                <Compass /> Mission Drills
              </h2>

              <div className="drills-grid">
                {/* Focus Visualization */}
                <div className="drill-card">
                  <div className="drill-header">
                    <Target size={18} /> Focus Visualization
                  </div>
                  <p className="drill-sub">“Stare at the center star” — 60s focus</p>
                  <div className="focus-star">
                    <div className="focus-core" />
                    <div className="focus-ring" />
                  </div>
                  <button className="btn-ghost" onClick={() => startTimer("focus-timer")}>
                    <Timer size={16} /> Start 60s
                  </button>
                  <div id="focus-timer" className="timer-readout">Ready</div>
                </div>

                {/* Zero-Gravity Stretch */}
                <div className="drill-card">
                  <div className="drill-header">
                    <Wind size={18} /> Zero-Gravity Stretch
                  </div>
                  <p className="drill-sub">Follow the animated cadence: Inhale ⟶ Hold ⟶ Exhale</p>
                  <div className="zero-stretch">
                    <div className="stretch-bar stretch-a" />
                    <div className="stretch-bar stretch-b" />
                    <div className="stretch-bar stretch-c" />
                  </div>
                  <div className="stretch-legend">
                    <span>Inhale</span><span>Hold</span><span>Exhale</span>
                  </div>
                </div>

                {/* Calm Orbit */}
                <div className="drill-card">
                  <div className="drill-header">
                    <Rocket size={18} /> Calm Orbit
                  </div>
                  <p className="drill-sub">Slow rotation + 90s relaxation timer</p>
                  <div className="calm-orbit">
                    <div className="orbit-path" />
                    <div className="orbit-dot" />
                  </div>
                  <button className="btn-ghost" onClick={() => startTimer("orbit-timer", 90)}>
                    <Timer size={16} /> Start 90s
                  </button>
                  <div id="orbit-timer" className="timer-readout">Ready</div>
                </div>
              </div>
            </motion.section>
          )}

          {/* Comms • AI (Chatbot) */}
          {activeSection === "chatbot" && (
            <motion.section className="section glass" key="chatbot" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2><MessageCircle className="inline" /> Comms • AI</h2>
              <div className="chat-area">
                <input
                  placeholder="Ask or share how you feel..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                />
                <button onClick={sendChat}>Send</button>
              </div>
              <p className="chat-response">{chatResponse}</p>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="footer">
        MAITRI • A Mental Wellness App for Astronauts
      </footer>
    </div>
  );
}

/** simple local timers for drills */
function startTimer(id, secs = 60) {
  const el = document.getElementById(id);
  if (!el) return;
  let t = secs;
  el.textContent = `${t}s`;
  el.classList.add("ticking");
  const int = setInterval(() => {
    t -= 1;
    el.textContent = t > 0 ? `${t}s` : "Done ✓";
    if (t <= 0) {
      el.classList.remove("ticking");
      clearInterval(int);
    }
  }, 1000);
}

export default App;
