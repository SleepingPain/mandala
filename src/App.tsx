import { useState, useEffect, useRef, useCallback } from "react";
import html2canvas from "html2canvas";

let _id = Date.now();
const uid = () => String(++_id);

// ===== Colors =====
const C = {
  bg: "#F8FAFC", surface: "#FFFFFF", surfaceAlt: "#F1F5F9",
  border: "#E2E8F0", borderLight: "#F1F5F9",
  text: "#1E293B", textSub: "#64748B", textMuted: "#94A3B8",
  primary: "#6366F1", primaryLight: "#EEF2FF", primaryBorder: "#C7D2FE",
  accent: "#10B981", accentLight: "#ECFDF5", accentBorder: "#A7F3D0",
  warm: "#F59E0B", warmLight: "#FFFBEB", warmBorder: "#FDE68A",
  rose: "#F43F5E", violet: "#8B5CF6", violetLight: "#F5F3FF", violetBorder: "#DDD6FE",
};

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {};
const colorPalette = [
  { bg: "#EEF2FF", text: "#4338CA", border: "#C7D2FE" },
  { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  { bg: "#FFF1F2", text: "#9F1239", border: "#FECDD3" },
  { bg: "#F0F9FF", text: "#075985", border: "#BAE6FD" },
  { bg: "#FDF4FF", text: "#86198F", border: "#F0ABFC" },
  { bg: "#FFF7ED", text: "#9A3412", border: "#FED7AA" },
  { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
];
const getCategoryColor = (cat: string) => {
  if (!categoryColors[cat]) {
    const idx = Object.keys(categoryColors).length % colorPalette.length;
    categoryColors[cat] = colorPalette[idx];
  }
  return categoryColors[cat];
};

const statusStyle: Record<string, { bg: string; border: string; text: string; label: string }> = {
  draft: { bg: C.warmLight, border: C.warmBorder, text: "#92400E", label: "임시" },
  placed: { bg: C.primaryLight, border: C.primaryBorder, text: "#4338CA", label: "배치됨" },
  done: { bg: C.accentLight, border: C.accentBorder, text: "#065F46", label: "완료" },
  reflect: { bg: C.violetLight, border: C.violetBorder, text: "#6D28D9", label: "회고" },
};

const priorityMeta: Record<string, { color: string; label: string; emoji: string }> = {
  high: { color: "#EF4444", label: "높음", emoji: "🔴" },
  medium: { color: "#F59E0B", label: "보통", emoji: "🟡" },
  low: { color: "#10B981", label: "낮음", emoji: "🟢" },
};

const folderColors = ["#EEF2FF", "#ECFDF5", "#FFFBEB", "#FFF1F2", "#F0F9FF", "#FDF4FF"];

// ===== Mandal-Art 9x9 Position Colors =====
const posTheme: Record<number, { bg: string; fill: string; border: string; text: string }> = {
  0: { bg: "#F5F3FF", fill: "#C7D2FE", border: "#DDD6FE", text: "#5B21B6" },
  1: { bg: "#ECFDF5", fill: "#BBF7D0", border: "#A7F3D0", text: "#065F46" },
  2: { bg: "#FEFCE8", fill: "#FEF08A", border: "#FDE68A", text: "#854D0E" },
  3: { bg: "#FFF1F2", fill: "#FECDD3", border: "#FDA4AF", text: "#9F1239" },
  5: { bg: "#F5F3FF", fill: "#DDD6FE", border: "#C4B5FD", text: "#6D28D9" },
  6: { bg: "#FDF2F8", fill: "#FBCFE8", border: "#F9A8D4", text: "#9D174D" },
  7: { bg: "#F0FDFA", fill: "#CCFBF1", border: "#99F6E4", text: "#115E59" },
  8: { bg: "#FFF1F2", fill: "#FECDD3", border: "#FDA4AF", text: "#BE123C" },
};

// ===== Types =====
interface Task {
  id: string; text: string; status: string; memo: string; folderId: string | null;
  boardId: string | null; cellPosition: number | null; completedAt: string | null;
  toReflect: boolean; _today: boolean;
  priority: string | null; urgency: string | null; importance: string | null;
  category: string | null;
  timeSlot: { start: number; duration: number } | null;
  clusterId: string | null;
  deadline: string | null; // ISO date string
}
interface Folder { id: string; title: string; color: string; rootBoardId: string; memo: string; }
interface Board { id: string; folderId: string | null; parentCellId: string | null; title: string; }
interface Cell { id: string; boardId: string; position: number; text: string; linkedTaskIds: string[]; childBoardId: string | null; }
interface Reflection { id: string; date: string; linkedTaskIds: string[]; text: string; }
interface Cluster { id: string; label: string; taskIds: string[]; }
interface Connection { id: string; fromId: string; toId: string; type: "task" | "folder"; }
interface DailyMood { date: string; mood: number; note: string; }
interface FolderLink { id: string; fromFolderId: string; toFolderId: string; label: string; }
interface AppData {
  tasks: Task[]; folders: Folder[]; boards: Board[]; cells: Cell[]; reflections: Reflection[];
  clusters: Cluster[]; connections: Connection[]; dailyMoods: DailyMood[];
  folderLinks: FolderLink[];
}
interface AiQuestion { id: string; text: string; options?: string[]; context: string; }

// ===== User Profile =====
interface UserProfile {
  occupation: string;
  goals: string[];
  lifePattern: string;
  values: string;
  concerns: string;
  rawAnswers: { question: string; answer: string }[];
  completed: boolean;
  bio: string; // 자유 형식 자기소개/추가 정보
}
const PROFILE_KEY = "mandal-profile";
const loadProfile = (): UserProfile | null => {
  try { const r = localStorage.getItem(PROFILE_KEY); if (r) { const p = JSON.parse(r); return { ...p, bio: p.bio ?? "" }; } } catch {}
  return null;
};
const saveProfile = (p: UserProfile) => localStorage.setItem(PROFILE_KEY, JSON.stringify(p));

// Onboarding question flow
interface OnboardingStep {
  question: string;
  options?: string[];
  key: string; // which profile field this maps to
  multi?: boolean;
}
const ONBOARDING_STEPS: OnboardingStep[] = [
  { question: "어떤 일을 하고 계세요?", options: ["직장인", "학생", "프리랜서", "사업가", "취준생", "기타"], key: "occupation" },
  { question: "요즘 가장 중요한 목표 2~3가지는?", options: ["커리어 성장", "건강/운동", "학업/공부", "재정/저축", "인간관계", "자기계발", "창업/사이드프로젝트", "워라밸"], key: "goals", multi: true },
  { question: "하루 루틴이 어떻게 되세요?", options: ["아침형 (6시 전 기상)", "보통 (7~8시 기상)", "올빼미형 (늦게 자고 늦게 일어남)", "불규칙"], key: "lifePattern" },
  { question: "일할 때 어떤 스타일이세요?", options: ["계획적으로 하나씩", "멀티태스킹", "마감 직전 몰아서", "영감이 올 때 집중"], key: "values" },
  { question: "요즘 가장 신경 쓰이는 고민은?", options: ["시간이 부족함", "우선순위 정하기 어려움", "동기부여가 안 됨", "일과 생활 균형", "목표가 불분명함"], key: "concerns" },
];
const profileToContext = (p: UserProfile): string => {
  const parts = [`직업: ${p.occupation}`, `목표: ${p.goals.join(", ")}`, `생활패턴: ${p.lifePattern}`, `업무스타일: ${p.values}`, `고민: ${p.concerns}`];
  if (p.rawAnswers.length > ONBOARDING_STEPS.length) {
    const extra = p.rawAnswers.slice(ONBOARDING_STEPS.length);
    extra.forEach(a => parts.push(`${a.question}: ${a.answer}`));
  }
  if (p.bio) parts.push(`\n추가 정보:\n${p.bio}`);
  return parts.join("\n");
};

// ===== XP System =====
const XP_KEY = "mandal-xp";
const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500, 10000];
const GROWTH_ICONS = ["🌱", "🌿", "🪴", "🌳", "🌲", "🏔️"];
const loadXP = (): { xp: number; streak: number; lastDate: string } => {
  try { const r = localStorage.getItem(XP_KEY); if (r) return JSON.parse(r); } catch {}
  return { xp: 0, streak: 0, lastDate: "" };
};
const saveXP = (d: { xp: number; streak: number; lastDate: string }) => {
  localStorage.setItem(XP_KEY, JSON.stringify(d));
};
const getLevel = (xp: number) => {
  let lvl = 0;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) { lvl = i; break; }
  }
  return lvl;
};
const getGrowthIcon = (lvl: number) => GROWTH_ICONS[Math.min(lvl, GROWTH_ICONS.length - 1)];
const addXP = (amount: number) => {
  const d = loadXP();
  const today = new Date().toISOString().slice(0, 10);
  if (d.lastDate === today) { d.xp += amount; }
  else {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    d.streak = d.lastDate === yesterday ? d.streak + 1 : 1;
    if (d.streak >= 3) amount += 30; // streak bonus
    d.xp += amount;
    d.lastDate = today;
  }
  saveXP(d);
  return d;
};

// ===== Auto-classify =====
function autoClassify(d: AppData) {
  const unplaced = d.tasks.filter(t => t.status === "draft" && !t.folderId);
  if (!unplaced.length || !d.folders.length) return;
  for (const task of unplaced) {
    const tw = task.text.toLowerCase();
    let bestFolder: Folder | null = null, bestScore = 0;
    for (const folder of d.folders) {
      let score = 0;
      const fn = folder.title.toLowerCase();
      if (tw.includes(fn) || fn.includes(tw)) score += 10;
      fn.split(/\s+/).forEach(w => { if (w.length >= 2 && tw.includes(w)) score += 5; });
      d.cells.filter(c => c.boardId === folder.rootBoardId).forEach(c => {
        if (!c.text) return;
        const ct = c.text.toLowerCase();
        if (tw.includes(ct) || ct.includes(tw)) score += 3;
      });
      if (score > bestScore) { bestScore = score; bestFolder = folder; }
    }
    if (bestFolder && bestScore >= 2) {
      task.folderId = bestFolder.id; task.status = "placed"; task.boardId = bestFolder.rootBoardId;
      const empty = d.cells.filter(c => c.boardId === bestFolder!.rootBoardId && c.position !== 4 && !c.text)
        .sort((a, b) => a.position - b.position)[0];
      if (empty) { empty.text = task.text; empty.linkedTaskIds.push(task.id); task.cellPosition = empty.position; }
    }
  }
}

// ===== AI =====
const AI_KEY = "mandal-ai-key";
const getAiKey = () => localStorage.getItem(AI_KEY) || "";
const setAiKey = (k: string) => localStorage.setItem(AI_KEY, k);

async function callAI(systemPrompt: string, prompt: string): Promise<string> {
  const apiKey = getAiKey();
  if (!apiKey) throw new Error("설정(⚙)에서 API 키를 입력해주세요");
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemPrompt, prompt, apiKey }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    try { const j = JSON.parse(text); throw new Error(j.error?.message || j.error || `HTTP ${res.status}`); } catch (e) { if (e instanceof SyntaxError) throw new Error(`서버 오류 (${res.status})`); throw e; }
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error?.message || data.error);
  return data.content?.[0]?.text || "";
}

// ===== Storage =====
const STORAGE_KEY = "mandal-v2";
const PATTERN_KEY = "mandal-patterns";
const migrateTask = (t: any): Task => ({
  ...t, priority: t.priority ?? null, urgency: t.urgency ?? null,
  importance: t.importance ?? null, category: t.category ?? null,
  timeSlot: t.timeSlot ?? null, clusterId: t.clusterId ?? null,
  deadline: t.deadline ?? null,
});
const migrateFolder = (f: any): Folder => ({ ...f, memo: f.memo ?? "" });
const migrateData = (d: any): AppData => ({
  ...d,
  tasks: (d.tasks || []).map(migrateTask),
  folders: (d.folders || []).map(migrateFolder),
  clusters: d.clusters || [],
  connections: d.connections || [],
  dailyMoods: d.dailyMoods || [],
  folderLinks: d.folderLinks || [],
});
const loadData = (): AppData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrateData(JSON.parse(raw));
  } catch {}
  return { tasks: [], folders: [], boards: [], cells: [], reflections: [], clusters: [], connections: [], dailyMoods: [], folderLinks: [] };
};
const saveData = (data: AppData) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {} };

// ===== Nav State =====
const NAV_KEY = "mandal-nav";
interface NavState { tab: string; selFolderId: string | null; boardPath: string[]; }
const loadNav = (): NavState | null => {
  try { const r = localStorage.getItem(NAV_KEY); if (r) return JSON.parse(r); } catch {}
  return null;
};
const saveNav = (s: NavState) => { try { localStorage.setItem(NAV_KEY, JSON.stringify(s)); } catch {} };

const loadPatterns = (): Record<string, string[]> => {
  try { const r = localStorage.getItem(PATTERN_KEY); if (r) return JSON.parse(r); } catch {}
  return {};
};
const savePatterns = (p: Record<string, string[]>) => { try { localStorage.setItem(PATTERN_KEY, JSON.stringify(p)); } catch {} };
const learnPattern = (category: string, keywords: string[]) => {
  const p = loadPatterns();
  if (!p[category]) p[category] = [];
  keywords.forEach(k => { if (!p[category].includes(k)) p[category].push(k); });
  savePatterns(p);
};

// ===== UI Components =====
const Btn = ({ children, variant = "default", style: s, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => {
  const vs: Record<string, React.CSSProperties> = {
    primary: { background: C.primary, color: "#fff", border: "none" },
    accent: { background: C.accent, color: "#fff", border: "none" },
    warm: { background: C.warm, color: "#fff", border: "none" },
    violet: { background: C.violet, color: "#fff", border: "none" },
    danger: { background: "#fff", color: C.rose, border: `1.5px solid ${C.rose}` },
    default: { background: "#fff", color: C.text, border: `1.5px solid ${C.border}` },
    ghost: { background: "transparent", color: C.textSub, border: "none" },
  };
  return (
    <button {...props} style={{
      ...(vs[variant] || vs.default), padding: "8px 16px", borderRadius: 8, cursor: "pointer",
      fontWeight: 600, fontSize: 13, transition: "all .15s", ...s
    }}>{children}</button>
  );
};

const SectionHeader = ({ icon, title, sub, right }: { icon: string; title: string; sub?: string; right?: React.ReactNode }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 18 }}>{icon}</span> {title}
      </h2>
      {sub && <p style={{ fontSize: 12, color: C.textMuted, margin: "4px 0 0" }}>{sub}</p>}
    </div>
    {right}
  </div>
);

const PriorityBadge = ({ level }: { level: string | null }) => {
  if (!level) return null;
  const m = priorityMeta[level];
  return m ? <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: m.color + "18", color: m.color, fontWeight: 600 }}>{m.emoji} {m.label}</span> : null;
};

const exportAsImage = async (el: HTMLElement, name: string) => {
  const canvas = await html2canvas(el, { backgroundColor: "#fff", scale: 2, useCORS: true });
  const a = document.createElement("a"); a.download = name; a.href = canvas.toDataURL("image/png"); a.click();
};

// ===== Timeline helpers =====
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6~23
const formatHour = (h: number) => `${String(h).padStart(2, "0")}:00`;
const slotToY = (hour: number) => (hour - 6) * 60; // 60px per hour
const durationToH = (blocks: number) => blocks * 30; // 30min = 30px

// ===== Main =====
export default function App() {
  const [data, setData] = useState<AppData>(loadData);
  const _savedNav = loadNav();
  const [tab, setTab] = useState(_savedNav?.tab || "home");
  const [selFolderId, setSelFolderId] = useState<string | null>(_savedNav?.selFolderId || null);
  const [boardPath, setBoardPath] = useState<string[]>(_savedNav?.boardPath || []);
  const [selTaskId, setSelTaskId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [refDate, setRefDate] = useState(new Date().toISOString().slice(0, 10));
  const [refText, setRefText] = useState("");
  const [editCellId, setEditCellId] = useState<string | null>(null);
  const [editCellText, setEditCellText] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [aiKeyInput, setAiKeyInput] = useState(getAiKey());
  const [aiLoading, setAiLoading] = useState(false);
  const [sortBy, setSortBy] = useState("none");
  const [filterPriority, setFilterPriority] = useState("all");
  const [aiQuestions, setAiQuestions] = useState<AiQuestion[]>([]);
  const [inputFocused, setInputFocused] = useState(false);
  // New state
  const [xpData, setXpData] = useState(loadXP);
  const [selectedAtoms, setSelectedAtoms] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [reflectionStep, setReflectionStep] = useState(0); // 0=mood, 1=review, 2=ai
  const [moodVal, setMoodVal] = useState(3);
  const [moodNote, setMoodNote] = useState("");
  const [xpToast, setXpToast] = useState<string | null>(null);
  // Onboarding
  const [profile, setProfile] = useState<UserProfile | null>(loadProfile);
  const [onboardStep, setOnboardStep] = useState(0);
  const [onboardAnswers, setOnboardAnswers] = useState<{ question: string; answer: string }[]>([]);
  const [onboardInput, setOnboardInput] = useState("");
  const [onboardMultiSel, setOnboardMultiSel] = useState<Set<string>>(new Set());
  const [aiOnboardQ, setAiOnboardQ] = useState<{ question: string; options?: string[] } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(!loadProfile()?.completed);

  const [dragCellId, setDragCellId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"mandal" | "matrix">("mandal");

  // Coach chat state
  const [coachMessages, setCoachMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [coachInput, setCoachInput] = useState("");
  const [coachLoading, setCoachLoading] = useState(false);
  const coachEndRef = useRef<HTMLDivElement>(null);

  const mandalRef = useRef<HTMLDivElement>(null);
  const homeRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const t = setTimeout(() => saveData(data), 400); return () => clearTimeout(t); }, [data]);

  // Persist nav state
  useEffect(() => { saveNav({ tab, selFolderId, boardPath }); }, [tab, selFolderId, boardPath]);

  // Browser back/forward button support for mandal-art drill-down
  const boardPathRef = useRef(boardPath);
  boardPathRef.current = boardPath;
  const tabRef = useRef(tab);
  tabRef.current = tab;

  useEffect(() => {
    // Push initial state
    if (!window.history.state?._mandal) {
      window.history.replaceState({ _mandal: true, boardPath, tab }, "");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Push state when boardPath or tab changes (but not from popstate)
  const isPopRef = useRef(false);
  useEffect(() => {
    if (isPopRef.current) { isPopRef.current = false; return; }
    window.history.pushState({ _mandal: true, boardPath, tab }, "");
  }, [boardPath, tab]);

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const state = e.state;
      if (state?._mandal) {
        isPopRef.current = true;
        if (state.tab) setTab(state.tab);
        if (state.boardPath) setBoardPath(state.boardPath);
      } else {
        // If no mandal state, go up in board or back to previous tab
        isPopRef.current = true;
        if (boardPathRef.current.length > 1) {
          const newPath = boardPathRef.current.slice(0, -1);
          setBoardPath(newPath);
          window.history.pushState({ _mandal: true, boardPath: newPath, tab: tabRef.current }, "");
        }
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Validate saved nav on mount & auto-open first folder if on mandal tab with no board
  useEffect(() => {
    if (selFolderId && !data.folders.find(f => f.id === selFolderId)) {
      setSelFolderId(null); setBoardPath([]); setTab("home");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open first folder's board when entering mandal tab with no board selected
  useEffect(() => {
    if (tab === "mandal" && !curBoardId && data.folders.length > 0) {
      const f = data.folders[0];
      setSelFolderId(f.id);
      setBoardPath([f.rootBoardId]);
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); }, []);
  const showXPGain = useCallback((amount: number) => { setXpToast(`+${amount} XP`); setTimeout(() => setXpToast(null), 2000); }, []);
  const up = (fn: (d: AppData) => void) => setData(p => { const n = JSON.parse(JSON.stringify(p)); fn(n); return n; });

  const gainXP = useCallback((amount: number) => {
    const newXP = addXP(amount);
    setXpData({ ...newXP });
    showXPGain(amount);
  }, [showXPGain]);

  const drafts = data.tasks.filter(t => t.status === "draft");
  const todayList = data.tasks.filter(t => t._today);
  const todayDone = todayList.filter(t => t.status === "done" || t.status === "reflect").length;
  const curBoardId = boardPath[boardPath.length - 1] || null;
  const curCells = data.cells.filter(c => c.boardId === curBoardId).sort((a, b) => a.position - b.position);
  const selTask = data.tasks.find(t => t.id === selTaskId) || null;
  const curRef = data.reflections.find(r => r.date === refDate);
  const hasContent = data.tasks.length > 0;
  const categories = [...new Set(data.tasks.map(t => t.category).filter(Boolean))] as string[];
  const level = getLevel(xpData.xp);
  const nextLevelXP = LEVEL_THRESHOLDS[Math.min(level + 1, LEVEL_THRESHOLDS.length - 1)];
  const prevLevelXP = LEVEL_THRESHOLDS[level];
  const xpProgress = nextLevelXP > prevLevelXP ? ((xpData.xp - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100 : 100;

  // Load today's mood
  const todayMood = data.dailyMoods.find(m => m.date === refDate);

  // Auto-create child boards for 9x9 expanded view
  useEffect(() => {
    if (tab !== "mandal" || boardPath.length !== 1 || !curBoardId) return;
    const rootCells = data.cells.filter(c => c.boardId === curBoardId && c.position !== 4 && !c.childBoardId);
    if (rootCells.length === 0) return;
    up(d => {
      for (const rc of rootCells) {
        const cell = d.cells.find(c => c.id === rc.id);
        if (!cell || cell.childBoardId) continue;
        const childId = uid();
        cell.childBoardId = childId;
        d.boards.push({ id: childId, folderId: selFolderId, parentCellId: cell.id, title: cell.text || "" });
        for (let i = 0; i < 9; i++) {
          d.cells.push({ id: uid(), boardId: childId, position: i, text: i === 4 ? (cell.text || "") : "", linkedTaskIds: [], childBoardId: null });
        }
      }
    });
  }, [tab, curBoardId, boardPath.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortTasks = (tasks: Task[]) => {
    const order = { high: 0, medium: 1, low: 2 };
    const getVal = (t: Task, key: string) => order[(t as any)[key] as keyof typeof order] ?? 3;
    let sorted = [...tasks];
    if (sortBy !== "none") sorted.sort((a, b) => getVal(a, sortBy) - getVal(b, sortBy));
    if (filterPriority !== "all") sorted = sorted.filter(t => t.priority === filterPriority);
    return sorted;
  };

  // === Onboarding flow ===
  const answerOnboarding = (answer: string) => {
    const step = ONBOARDING_STEPS[onboardStep];
    const newAnswers = [...onboardAnswers, { question: step?.question || aiOnboardQ?.question || "", answer }];
    setOnboardAnswers(newAnswers);
    setOnboardInput("");
    setOnboardMultiSel(new Set());

    const nextStep = onboardStep + 1;
    if (nextStep < ONBOARDING_STEPS.length) {
      setOnboardStep(nextStep);
      setAiOnboardQ(null);
    } else if (nextStep === ONBOARDING_STEPS.length) {
      // After predefined questions, ask AI for 2 follow-up questions
      setOnboardStep(nextStep);
      generateOnboardFollowUp(newAnswers);
    } else if (nextStep === ONBOARDING_STEPS.length + 1) {
      // One more AI question
      setOnboardStep(nextStep);
      generateOnboardFollowUp(newAnswers);
    } else {
      // Done - build profile
      completeOnboarding(newAnswers);
    }
  };

  const generateOnboardFollowUp = async (answers: { question: string; answer: string }[]) => {
    try {
      const ctx = answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join("\n");
      const result = await callAI(
        "사용자의 만다라트 시간관리를 돕기 위해 프로필을 수집 중입니다. 이전 답변을 기반으로 더 깊이 이해하기 위한 후속 질문 1개를 만들어주세요. 순수 JSON만 응답.",
        `이전 답변:\n${ctx}\n\n후속 질문 1개를 만들어주세요. 순수 JSON:\n{"question": "질문", "options": ["선택지1", "선택지2", "선택지3", "선택지4"]}`
      );
      const json = JSON.parse(result.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
      setAiOnboardQ(json);
    } catch {
      // If AI fails, just complete
      completeOnboarding(answers);
    }
  };

  const completeOnboarding = (answers: { question: string; answer: string }[]) => {
    const p: UserProfile = {
      occupation: answers[0]?.answer || "",
      goals: (answers[1]?.answer || "").split(", "),
      lifePattern: answers[2]?.answer || "",
      values: answers[3]?.answer || "",
      concerns: answers[4]?.answer || "",
      rawAnswers: answers,
      completed: true,
      bio: "",
    };
    saveProfile(p);
    setProfile(p);
    setShowOnboarding(false);
    showToast("프로필 완성! AI가 당신을 이해합니다");
    // Auto-create suggested folders from goals
    up(d => {
      p.goals.forEach(goal => {
        if (goal && !d.folders.find(f => f.title === goal)) {
          createFolderInData(d, goal);
        }
      });
    });
  };

  const profileContext = profile ? profileToContext(profile) : "";

  // === AI auto-classify ===
  const aiClassifyTasks = async (taskTexts: string[]) => {
    setAiLoading(true);
    try {
      const existingCategories = categories.length > 0 ? categories.join(", ") : "없음 (새로 만들어주세요)";
      const existingFolders = data.folders.map(f => `${f.id}:${f.title}`).join(", ") || "없음";
      const patterns = loadPatterns();
      const patternInfo = Object.entries(patterns).map(([cat, kws]) => `${cat}: ${kws.slice(0, 10).join(", ")}`).join("\n") || "아직 없음";

      const prompt = `새로 입력된 할 일을 분류해주세요.

${profileContext ? `사용자 프로필:\n${profileContext}\n` : ""}기존 카테고리: ${existingCategories}
기존 폴더: ${existingFolders}
사용자 패턴:
${patternInfo}

새 할 일:
${taskTexts.map((t, i) => `${i + 1}. ${t}`).join("\n")}

반드시 순수 JSON만 응답하세요:
{
  "tasks": [
    {
      "text": "할일 텍스트",
      "category": "카테고리명 (기존 것 사용 또는 새로 생성)",
      "priority": "high|medium|low",
      "urgency": "high|medium|low",
      "importance": "high|medium|low",
      "suggestedFolder": "폴더ID 또는 null",
      "newFolderName": "새 폴더가 필요하면 이름, 아니면 null"
    }
  ],
  "question": "사용자에게 물어볼 질문 하나 (분류 정확도를 높이기 위한 질문, 없으면 null)"
}`;

      const result = await callAI(
        "당신은 만다라트 시간관리 전문가입니다. 사용자의 할 일을 카테고리별로 분류하고 우선순위를 매깁니다. 반드시 순수 JSON만 응답하세요.",
        prompt
      );

      const json = JSON.parse(result.replace(/```json?\n?/g, "").replace(/```/g, "").trim());

      up(d => {
        const newFolders = new Set<string>();
        for (const a of json.tasks) {
          if (a.newFolderName && !d.folders.find(f => f.title === a.newFolderName) && !newFolders.has(a.newFolderName)) {
            newFolders.add(a.newFolderName);
            const fId = uid(), bId = uid();
            d.folders.push({ id: fId, title: a.newFolderName, color: folderColors[d.folders.length % folderColors.length], rootBoardId: bId, memo: "" });
            d.boards.push({ id: bId, folderId: fId, parentCellId: null, title: a.newFolderName });
            for (let i = 0; i < 9; i++) d.cells.push({ id: uid(), boardId: bId, position: i, text: i === 4 ? a.newFolderName : "", linkedTaskIds: [], childBoardId: null });
          }
        }
        for (const a of json.tasks) {
          const task = d.tasks.find(t => t.text === a.text);
          if (!task) continue;
          if (a.category) { task.category = a.category; learnPattern(a.category, a.text.split(/\s+/)); }
          if (a.priority) task.priority = a.priority;
          if (a.urgency) task.urgency = a.urgency;
          if (a.importance) task.importance = a.importance;
          const targetFolderId = a.suggestedFolder || (a.newFolderName ? d.folders.find(f => f.title === a.newFolderName)?.id : null);
          if (targetFolderId) {
            const folder = d.folders.find(f => f.id === targetFolderId);
            if (folder) {
              task.folderId = folder.id; task.status = "placed"; task.boardId = folder.rootBoardId;
              const empty = d.cells.filter(c => c.boardId === folder.rootBoardId && c.position !== 4 && !c.text)
                .sort((x, y) => x.position - y.position)[0];
              if (empty) { empty.text = task.text; empty.linkedTaskIds.push(task.id); task.cellPosition = empty.position; }
            }
          }
        }
      });

      if (json.question) {
        setAiQuestions(prev => [...prev, { id: uid(), text: json.question, context: "classify" }]);
      }
      showToast(`${taskTexts.length}개 AI 자동 분류 완료`);
    } catch (e: any) {
      showToast("AI: " + e.message);
      up(d => { if (d.folders.length) autoClassify(d); });
    }
    setAiLoading(false);
  };

  // === Helper: create folder + board + 9 cells ===
  const createFolderInData = (d: AppData, title: string): Folder => {
    const fId = uid(), bId = uid();
    const folder: Folder = { id: fId, title, color: folderColors[d.folders.length % folderColors.length], rootBoardId: bId, memo: "" };
    d.folders.push(folder);
    d.boards.push({ id: bId, folderId: fId, parentCellId: null, title });
    for (let i = 0; i < 9; i++) d.cells.push({ id: uid(), boardId: bId, position: i, text: i === 4 ? title : "", linkedTaskIds: [], childBoardId: null });
    return folder;
  };

  // === Helper: place task into folder's board ===
  const placeTaskInFolder = (d: AppData, task: Task, folder: Folder) => {
    task.folderId = folder.id; task.status = "placed"; task.boardId = folder.rootBoardId;
    const empty = d.cells.filter(c => c.boardId === folder.rootBoardId && c.position !== 4 && !c.text)
      .sort((a, b) => a.position - b.position)[0];
    if (empty) { empty.text = task.text; empty.linkedTaskIds.push(task.id); task.cellPosition = empty.position; }
  };

  // === Input (supports #theme, #theme > task, plain text) ===
  const submitInput = async () => {
    const items = inputVal.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    if (!items.length) return;
    const plainTasks: string[] = [];
    up(d => {
      items.forEach(raw => {
        // "#theme > task" — create theme + place task under it
        const hierarchyMatch = raw.match(/^#(.+?)>\s*(.+)$/);
        if (hierarchyMatch) {
          const themeName = hierarchyMatch[1].trim();
          const taskText = hierarchyMatch[2].trim();
          let folder = d.folders.find(f => f.title === themeName);
          if (!folder) folder = createFolderInData(d, themeName);
          const task: Task = {
            id: uid(), text: taskText, status: "draft", memo: "", folderId: null, boardId: null,
            cellPosition: null, completedAt: null, toReflect: false, _today: false,
            priority: null, urgency: null, importance: null, category: themeName,
            timeSlot: null, clusterId: null, deadline: null,
          };
          d.tasks.push(task);
          placeTaskInFolder(d, task, folder);
          plainTasks.push(taskText);
          return;
        }
        // "#theme" — create theme (folder) only
        const themeMatch = raw.match(/^#(.+)$/);
        if (themeMatch) {
          const themeName = themeMatch[1].trim();
          if (!d.folders.find(f => f.title === themeName)) {
            createFolderInData(d, themeName);
          }
          return;
        }
        // plain text — atom
        const task: Task = {
          id: uid(), text: raw, status: "draft", memo: "", folderId: null, boardId: null,
          cellPosition: null, completedAt: null, toReflect: false, _today: false,
          priority: null, urgency: null, importance: null, category: null,
          timeSlot: null, clusterId: null, deadline: null,
        };
        d.tasks.push(task);
        plainTasks.push(raw);
      });
    });
    setInputVal("");
    if (plainTasks.length > 0) aiClassifyTasks(plainTasks);
    else showToast("주제/폴더 생성됨");
  };

  // === AI question ===
  const answerAiQuestion = async (questionId: string, answer: string) => {
    setAiQuestions(prev => prev.filter(q => q.id !== questionId));
    const patterns = loadPatterns();
    if (!patterns["_feedback"]) patterns["_feedback"] = [];
    patterns["_feedback"].push(answer);
    savePatterns(patterns);
    showToast("답변 반영됨");
  };

  const generateEvolutionQuestion = async () => {
    setAiLoading(true);
    try {
      const taskSummary = data.tasks.slice(-20).map(t => `${t.text} [${t.category || "미분류"}]`).join(", ");
      const prompt = `사용자의 최근 할 일 패턴을 분석하고, 더 잘 도와주기 위해 물어볼 질문 2개를 만들어주세요.

최근 항목: ${taskSummary}
카테고리: ${categories.join(", ") || "없음"}

순수 JSON으로 응답:
{ "questions": [{ "text": "질문 내용", "options": ["선택지1", "선택지2", "선택지3"] }] }`;

      const result = await callAI("사용자의 업무 패턴을 이해하고 개선하기 위한 질문을 생성합니다. 순수 JSON만 응답.", prompt);
      const json = JSON.parse(result.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
      setAiQuestions(prev => [
        ...prev,
        ...json.questions.map((q: any) => ({ id: uid(), text: q.text, options: q.options, context: "evolution" })),
      ]);
    } catch (e: any) { showToast("AI: " + e.message); }
    setAiLoading(false);
  };

  // === AI daily reflection ===
  const handleAIReflection = async () => {
    setAiLoading(true);
    try {
      const done = data.tasks.filter(t => (t.status === "done" || t.status === "reflect") && t.completedAt?.startsWith(refDate));
      const today = data.tasks.filter(t => t._today);
      const notDone = today.filter(t => t.status !== "done" && t.status !== "reflect");
      const moodInfo = todayMood ? `기분: ${todayMood.mood}/5, 메모: ${todayMood.note}` : "";
      const completionRate = today.length ? Math.round((done.length / today.length) * 100) : 0;
      const prompt = `날짜: ${refDate}
${moodInfo}
달성률: ${completionRate}%
완료: ${done.map(t => t.text).join(", ") || "없음"}
미완료: ${notDone.map(t => t.text).join(", ") || "없음"}
카테고리별 시간: ${categories.map(c => `${c}(${data.tasks.filter(t => t.category === c && t._today).length}개)`).join(", ")}

짧고 따뜻하게 하루를 정리해주세요:
## 오늘의 성과
## 잘한 점
## 개선할 점
## 내일 추천 스케줄`;
      const sysPrompt = `따뜻하고 격려하는 하루 회고 코치입니다. 데이터 기반으로 구체적 피드백을 제공합니다.${profileContext ? `\n\n사용자 프로필:\n${profileContext}` : ""}`;
      const result = await callAI(sysPrompt, prompt);
      setRefText(result);
      gainXP(20);
      showToast("AI 하루 평가 완료");
    } catch (e: any) { showToast("AI: " + e.message); }
    setAiLoading(false);
  };

  // === Coach AI ===
  const buildCoachContext = () => {
    const today = new Date().toISOString().slice(0, 10);
    const todayTasks = data.tasks.filter(t => t._today);
    const doneTasks = todayTasks.filter(t => t.status === "done" || t.status === "reflect");
    const pendingTasks = todayTasks.filter(t => t.status !== "done" && t.status !== "reflect");
    const allDrafts = data.tasks.filter(t => t.status === "draft");
    const folders = data.folders.map(f => {
      const cells = data.cells.filter(c => c.boardId === f.rootBoardId && c.text);
      return `${f.title}: ${cells.map(c => c.text).join(", ")}`;
    }).join("\n");
    const recentReflections = data.reflections.slice(-3).map(r => `[${r.date}] ${r.text.slice(0, 200)}`).join("\n");
    const mood = data.dailyMoods.find(m => m.date === today);
    const moodStr = mood ? `오늘 기분: ${["", "😫힘듦", "😐그저그럼", "🙂괜찮음", "😊좋음", "🤩최고"][mood.mood]}${mood.note ? ` (${mood.note})` : ""}` : "";
    const deadlines = data.tasks.filter(t => t.deadline && t.status !== "done" && t.status !== "reflect")
      .sort((a, b) => (a.deadline || "").localeCompare(b.deadline || ""))
      .slice(0, 5)
      .map(t => `- ${t.text} (D-${Math.ceil((new Date(t.deadline!).getTime() - Date.now()) / 86400000)})`).join("\n");

    return `오늘: ${today}
${profileContext ? `\n사용자 프로필:\n${profileContext}\n` : ""}
오늘의 업무 (${doneTasks.length}/${todayTasks.length} 완료):
완료: ${doneTasks.map(t => t.text).join(", ") || "없음"}
진행중: ${pendingTasks.map(t => t.text).join(", ") || "없음"}

임시함 (정리 대기): ${allDrafts.length}개${allDrafts.length > 0 ? " — " + allDrafts.slice(0, 5).map(t => t.text).join(", ") : ""}

만다라트 구조:
${folders || "아직 없음"}
${moodStr ? `\n${moodStr}` : ""}
${deadlines ? `\n다가오는 마감:\n${deadlines}` : ""}
${recentReflections ? `\n최근 회고:\n${recentReflections}` : ""}`;
  };

  const sendCoachMessage = async () => {
    const text = coachInput.trim();
    if (!text || coachLoading) return;
    const userMsg = { role: "user" as const, content: text };
    const newMessages = [...coachMessages, userMsg];
    setCoachMessages(newMessages);
    setCoachInput("");
    setCoachLoading(true);
    try {
      const context = buildCoachContext();
      const sysPrompt = `당신은 사용자의 개인 생산성 코치입니다. 따뜻하고 실용적인 조언을 합니다.
사용자의 만다라트 데이터, 오늘 할 일, 프로필을 바탕으로 맞춤형 코칭을 제공합니다.
대화 형식으로 자연스럽게 응답하세요. 너무 길지 않게, 핵심만 전달하세요.
마크다운 형식을 적절히 사용하세요.

${context}`;
      // Build conversation for context (last 6 messages)
      const recentConvo = newMessages.slice(-6).map(m => `${m.role === "user" ? "사용자" : "코치"}: ${m.content}`).join("\n\n");
      const prompt = recentConvo;
      const result = await callAI(sysPrompt, prompt);
      setCoachMessages(prev => [...prev, { role: "assistant", content: result }]);
      gainXP(10);
    } catch (e: any) {
      setCoachMessages(prev => [...prev, { role: "assistant", content: `오류: ${e.message}` }]);
    }
    setCoachLoading(false);
  };

  const startCoachSession = async (type: "morning" | "evening" | "plan") => {
    const prompts: Record<string, string> = {
      morning: "좋은 아침! 오늘 하루 계획을 세워줘. 내 오늘 할 일 목록을 보고 우선순위와 시간 배분을 추천해줘.",
      evening: "하루가 끝났어. 오늘 뭘 했는지 정리하고, 잘한 점과 개선할 점을 알려줘.",
      plan: "이번 주 전체적으로 어떻게 진행되고 있는지 점검해줘. 만다라트 목표 대비 진행상황도 알려줘.",
    };
    setCoachInput(prompts[type]);
  };

  // Auto-scroll coach chat
  useEffect(() => {
    coachEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [coachMessages, coachLoading]);

  // === Actions ===
  const createFolderAction = () => {
    if (!newFolder.trim()) return;
    up(d => {
      const fId = uid(), bId = uid();
      d.folders.push({ id: fId, title: newFolder.trim(), color: folderColors[d.folders.length % folderColors.length], rootBoardId: bId, memo: "" });
      d.boards.push({ id: bId, folderId: fId, parentCellId: null, title: newFolder.trim() });
      for (let i = 0; i < 9; i++) d.cells.push({ id: uid(), boardId: bId, position: i, text: i === 4 ? newFolder.trim() : "", linkedTaskIds: [], childBoardId: null });
      autoClassify(d);
    });
    setNewFolder(""); setShowNewFolder(false);
  };
  const openFolder = (f: Folder) => { setSelFolderId(f.id); setBoardPath([f.rootBoardId]); setTab("mandal"); };
  const dropFolder = (fId: string) => { if (!dragId) return; up(d => { const t = d.tasks.find(x => x.id === dragId); if (t) t.folderId = fId; }); setDragId(null); };
  const dropCell = (cId: string) => {
    if (!dragId) return;
    up(d => {
      const t = d.tasks.find(x => x.id === dragId); const c = d.cells.find(x => x.id === cId);
      if (t && c) {
        t.status = "placed"; t.boardId = c.boardId; t.cellPosition = c.position;
        t.folderId = d.boards.find(b => b.id === c.boardId)?.folderId || t.folderId;
        if (!c.linkedTaskIds.includes(t.id)) c.linkedTaskIds.push(t.id);
        if (!c.text) c.text = t.text;
        syncCellText(d, c);
      }
    });
    setDragId(null);
  };
  const swapCells = (id1: string, id2: string) => {
    up(d => {
      const c1 = d.cells.find(x => x.id === id1);
      const c2 = d.cells.find(x => x.id === id2);
      if (!c1 || !c2) return;
      // Swap content
      [c1.text, c2.text] = [c2.text, c1.text];
      [c1.linkedTaskIds, c2.linkedTaskIds] = [c2.linkedTaskIds, c1.linkedTaskIds];
      [c1.childBoardId, c2.childBoardId] = [c2.childBoardId, c1.childBoardId];
      // Update task cellPositions
      c1.linkedTaskIds.forEach(tid => { const t = d.tasks.find(x => x.id === tid); if (t) t.cellPosition = c1.position; });
      c2.linkedTaskIds.forEach(tid => { const t = d.tasks.find(x => x.id === tid); if (t) t.cellPosition = c2.position; });
      syncCellText(d, c1); syncCellText(d, c2);
    });
  };
  const clearCell = (cellId: string) => {
    up(d => {
      const c = d.cells.find(x => x.id === cellId);
      if (!c) return;
      // Return linked tasks to draft
      c.linkedTaskIds.forEach(tid => {
        const t = d.tasks.find(x => x.id === tid);
        if (t) { t.status = "draft"; t.boardId = null; t.cellPosition = null; }
      });
      // Recursively delete child board
      const deleteBoard = (boardId: string) => {
        const cells = d.cells.filter(x => x.boardId === boardId);
        cells.forEach(cc => {
          cc.linkedTaskIds.forEach(tid => {
            const t = d.tasks.find(x => x.id === tid);
            if (t) { t.status = "draft"; t.boardId = null; t.cellPosition = null; }
          });
          if (cc.childBoardId) deleteBoard(cc.childBoardId);
        });
        d.cells = d.cells.filter(x => x.boardId !== boardId);
        d.boards = d.boards.filter(x => x.id !== boardId);
      };
      if (c.childBoardId) deleteBoard(c.childBoardId);
      c.text = ""; c.linkedTaskIds = []; c.childBoardId = null;
    });
  };
  const drillDown = (cell: Cell) => {
    if (cell.position === 4) return;
    let childId = cell.childBoardId;
    if (!childId) {
      childId = uid();
      up(d => {
        const c = d.cells.find(x => x.id === cell.id); if (c) c.childBoardId = childId;
        d.boards.push({ id: childId!, folderId: selFolderId, parentCellId: cell.id, title: cell.text || "하위" });
        for (let i = 0; i < 9; i++) d.cells.push({ id: uid(), boardId: childId!, position: i, text: i === 4 ? (cell.text || "") : "", linkedTaskIds: [], childBoardId: null });
      });
    }
    setBoardPath(p => [...p, childId!]);
  };
  const goBack = () => { if (boardPath.length > 1) setBoardPath(p => p.slice(0, -1)); else { setBoardPath([]); setTab("mandal"); } };
  const markDone = (id: string) => {
    up(d => { const t = d.tasks.find(x => x.id === id); if (t) { t.status = "done"; t.completedAt = new Date().toISOString(); } });
    gainXP(10);
  };
  const moveToday = (id: string) => up(d => { const t = d.tasks.find(x => x.id === id); if (t) t._today = true; });
  const sendReflect = (id: string) => up(d => { const t = d.tasks.find(x => x.id === id); if (t) { t.toReflect = true; t.status = "reflect"; } });
  const delTask = (id: string) => { up(d => { d.tasks = d.tasks.filter(x => x.id !== id); d.cells.forEach(c => { c.linkedTaskIds = c.linkedTaskIds.filter(x => x !== id); }); d.clusters.forEach(cl => { cl.taskIds = cl.taskIds.filter(x => x !== id); }); d.connections = d.connections.filter(cn => cn.fromId !== id && cn.toId !== id); }); setSelTaskId(null); setShowDetail(false); };
  const saveRef = () => {
    if (!refText.trim()) return;
    up(d => {
      const rt = d.tasks.filter(t => t.toReflect).map(t => t.id);
      const ex = d.reflections.find(r => r.date === refDate);
      if (ex) { ex.text = refText; ex.linkedTaskIds = [...new Set([...ex.linkedTaskIds, ...rt])]; }
      else d.reflections.push({ id: uid(), date: refDate, linkedTaskIds: rt, text: refText });
    });
    showToast("저장됨");
  };
  const syncCellText = (d: AppData, cell: { id: string; boardId: string; position: number; text: string; childBoardId: string | null }) => {
    // If this is a center cell (pos 4) of a child board → sync text up to parent root cell
    if (cell.position === 4) {
      const parentCell = d.cells.find(c => c.childBoardId === cell.boardId);
      if (parentCell) parentCell.text = cell.text;
    }
    // If this root cell has a child board → sync text down to child board's center cell
    if (cell.childBoardId) {
      const childCenter = d.cells.find(c => c.boardId === cell.childBoardId && c.position === 4);
      if (childCenter) childCenter.text = cell.text;
    }
  };
  const saveCellEdit = () => { if (editCellId) { up(d => { const c = d.cells.find(x => x.id === editCellId); if (c) { c.text = editCellText; syncCellText(d, c); } }); setEditCellId(null); } };
  const breadcrumb = () => {
    const cr: { label: string; idx: number }[] = [];
    const f = data.folders.find(x => x.id === selFolderId);
    if (f) cr.push({ label: f.title, idx: 0 });
    for (let i = 1; i < boardPath.length; i++) { const b = data.boards.find(x => x.id === boardPath[i]); cr.push({ label: b?.title || "하위", idx: i }); }
    return cr;
  };

  // === Promote atom → theme (folder) ===
  const promoteToTheme = (taskId: string) => {
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) return;
    up(d => {
      const t = d.tasks.find(x => x.id === taskId);
      if (!t) return;
      // Create folder with task text as title
      const folder = createFolderInData(d, t.text);
      // Find related tasks (same category, or connected) and suggest placement
      const related = d.tasks.filter(x =>
        x.id !== taskId && (
          (t.category && x.category === t.category) ||
          d.connections.some(cn => (cn.fromId === taskId && cn.toId === x.id) || (cn.toId === taskId && cn.fromId === x.id))
        )
      );
      // Place related tasks into the new folder's board
      related.slice(0, 8).forEach(rel => {
        const r = d.tasks.find(x => x.id === rel.id);
        if (r) placeTaskInFolder(d, r, folder);
      });
      // Remove original task (it became the folder center)
      d.tasks = d.tasks.filter(x => x.id !== taskId);
      d.cells.forEach(c => { c.linkedTaskIds = c.linkedTaskIds.filter(x => x !== taskId); });
    });
    setShowDetail(false);
    showToast(`"${task.text}" → 주제로 승격`);
  };

  // === Dissolve folder → free atoms ===
  const dissolveFolder = (folderId: string) => {
    const folder = data.folders.find(f => f.id === folderId);
    if (!folder) return;
    up(d => {
      // Free all tasks in this folder
      d.tasks.forEach(t => {
        if (t.folderId === folderId) {
          t.folderId = null; t.boardId = null; t.cellPosition = null; t.status = "draft";
        }
      });
      // Remove folder, its boards, and cells
      const boardIds = d.boards.filter(b => b.folderId === folderId).map(b => b.id);
      d.cells = d.cells.filter(c => !boardIds.includes(c.boardId));
      d.boards = d.boards.filter(b => b.folderId !== folderId);
      d.folders = d.folders.filter(f => f.id !== folderId);
    });
    showToast(`"${folder.title}" 해체 → 항목들이 자유 atom으로`);
  };

  // === Cell direct input: click empty cell → type → create atom + place ===
  const [cellInputId, setCellInputId] = useState<string | null>(null);
  const [cellInputText, setCellInputText] = useState("");
  const commitCellInput = (cellId: string) => {
    if (!cellInputText.trim()) { setCellInputId(null); return; }
    const text = cellInputText.trim();
    up(d => {
      const c = d.cells.find(x => x.id === cellId);
      if (!c) return;
      // Create a new task atom
      const task: Task = {
        id: uid(), text, status: "placed", memo: "",
        folderId: d.boards.find(b => b.id === c.boardId)?.folderId || null,
        boardId: c.boardId, cellPosition: c.position,
        completedAt: null, toReflect: false, _today: false,
        priority: null, urgency: null, importance: null, category: null,
        timeSlot: null, clusterId: null, deadline: null,
      };
      d.tasks.push(task);
      c.text = text;
      c.linkedTaskIds.push(task.id);
      syncCellText(d, c);
    });
    setCellInputId(null);
    setCellInputText("");
  };

  // === Cluster merge ===
  const mergeSelected = () => {
    if (selectedAtoms.size < 2) return;
    const label = prompt("클러스터 이름을 입력하세요:");
    if (!label) return;
    const clId = uid();
    up(d => {
      d.clusters.push({ id: clId, label, taskIds: [...selectedAtoms] });
      selectedAtoms.forEach(tid => { const t = d.tasks.find(x => x.id === tid); if (t) t.clusterId = clId; });
    });
    setSelectedAtoms(new Set());
    setSelectMode(false);
    showToast(`${selectedAtoms.size}개 태스크 → "${label}" 클러스터`);
  };

  const unmergeCluster = (clId: string) => {
    up(d => {
      d.tasks.forEach(t => { if (t.clusterId === clId) t.clusterId = null; });
      d.clusters = d.clusters.filter(c => c.id !== clId);
    });
  };

  // === Connection ===
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);

  const toggleConnection = (taskId: string) => {
    if (!connectFrom) { setConnectFrom(taskId); return; }
    if (connectFrom === taskId) { setConnectFrom(null); return; }
    up(d => {
      const exists = d.connections.find(c => (c.fromId === connectFrom && c.toId === taskId) || (c.fromId === taskId && c.toId === connectFrom));
      if (exists) d.connections = d.connections.filter(c => c.id !== exists.id);
      else d.connections.push({ id: uid(), fromId: connectFrom!, toId: taskId, type: "task" });
    });
    setConnectFrom(null);
    setConnectMode(false);
  };

  // === Time slot ===
  const assignTimeSlot = (taskId: string, hour: number) => {
    up(d => {
      const t = d.tasks.find(x => x.id === taskId);
      if (t) { t.timeSlot = { start: hour, duration: 2 }; if (!t._today) t._today = true; }
    });
  };
  const removeTimeSlot = (taskId: string) => {
    up(d => { const t = d.tasks.find(x => x.id === taskId); if (t) t.timeSlot = null; });
  };
  const resizeTimeSlot = (taskId: string, newDuration: number) => {
    up(d => {
      const t = d.tasks.find(x => x.id === taskId);
      if (t && t.timeSlot) t.timeSlot.duration = Math.max(1, Math.min(8, newDuration));
    });
  };

  // === Save mood ===
  const saveMood = () => {
    up(d => {
      const existing = d.dailyMoods.find(m => m.date === refDate);
      if (existing) { existing.mood = moodVal; existing.note = moodNote; }
      else d.dailyMoods.push({ date: refDate, mood: moodVal, note: moodNote });
    });
    setReflectionStep(1);
    showToast("기분 기록됨");
  };

  // === Load analog mandal-art data ===
  const loadAnalogData = () => {
    up(d => {
      // Helper: create folder + board + cells
      const mkFolder = (title: string, centerText: string, cellTexts: string[]): Folder => {
        const fId = uid(), bId = uid();
        const folder: Folder = { id: fId, title, color: folderColors[d.folders.length % folderColors.length], rootBoardId: bId, memo: "" };
        d.folders.push(folder);
        d.boards.push({ id: bId, folderId: fId, parentCellId: null, title });
        const positions = [0,1,2,3,4,5,6,7,8];
        positions.forEach(i => {
          const text = i === 4 ? centerText : (cellTexts[i < 4 ? i : i - 1] || "");
          d.cells.push({ id: uid(), boardId: bId, position: i, text, linkedTaskIds: [], childBoardId: null });
        });
        return folder;
      };
      // Helper: create task in folder
      const mkTask = (text: string, folder: Folder, cat: string, opts?: Partial<Task>) => {
        const task: Task = {
          id: uid(), text, status: "placed", memo: "", folderId: folder.id, boardId: folder.rootBoardId,
          cellPosition: null, completedAt: null, toReflect: false, _today: false,
          priority: opts?.priority || null, urgency: opts?.urgency || null, importance: opts?.importance || null,
          category: cat, timeSlot: null, clusterId: null, deadline: opts?.deadline || null,
        };
        d.tasks.push(task);
        const empty = d.cells.filter(c => c.boardId === folder.rootBoardId && c.position !== 4 && !c.text)
          .sort((a, b) => a.position - b.position)[0];
        if (empty) { empty.text = text; empty.linkedTaskIds.push(task.id); task.cellPosition = empty.position; }
        return task;
      };

      // === Center Mandal-Art: Life themes ===
      // 1. 건강/운동
      const health = mkFolder("건강/운동", "건강/운동", ["운동 루틴", "식단 관리", "수면 관리", "스트레스 관리", "정기 검진", "체력 향상", "멘탈 관리", "생활 습관"]);
      health.memo = "규칙적인 생활 + 운동이 모든 것의 기반";

      // 2. R&D
      const rnd = mkFolder("R&D", "R&D", ["성능 분석", "아이디어 연구", "토론/회의", "논문 리뷰", "기술 트렌드", "실험/검증", "협업 연구", "포트폴리오"]);
      rnd.memo = "RISE 프로그램 연계";

      // 3. 사업
      const biz = mkFolder("사업", "사업", ["사업계획서", "마케팅 전략", "자금 조달", "팀 구성", "비즈니스 모델", "경쟁 분석", "네트워킹", "법률/행정"]);
      biz.memo = "지인 사업 + 창업 기회 탐색";

      // 4. 대외+활동
      const external = mkFolder("대외+활동", "대외+활동", ["대외활동 지원", "공모전", "봉사활동", "네트워킹", "세미나 참석", "동아리", "인턴십", "멘토링"]);

      // 5. 시간 관리
      const timeMgmt = mkFolder("시간 관리", "시간 관리", ["주간 계획", "일일 루틴", "우선순위 정리", "방해요소 제거", "데드라인 관리", "여유 시간 확보", "회고/반성", "도구 활용"]);

      // === 26년 1학기 수업 (가장 디테일한 섹션) ===
      const semester = mkFolder("26년 1학기 수업", "26년 1학기", ["사업계획서", "마케팅", "트렌드분석", "사고력", "기획", "HRD", "데이터분석", "창업론"]);
      semester.memo = "수업 간 시너지: 마케팅↔사업계획서, 데이터분석↔트렌드, 사고력→기획→사업계획서\n\n프레임워크:\n- 사고력/비판적 사고 → 기획 능력 → 사업 전략\n- 마케팅 + 트렌드 → 시장 분석\n- 데이터 분석 → 근거 기반 의사결정\n- HRD → 팀 관리 / 리더십";

      // --- 개별 수업 태스크들 ---
      // 사업계획서
      mkTask("사업계획서 초안 작성", semester, "사업계획서", { priority: "high", urgency: "high" });
      mkTask("사업계획서 시장조사", semester, "사업계획서", { priority: "high" });
      mkTask("사업계획서 재무계획", semester, "사업계획서");
      mkTask("사업계획서 발표 준비", semester, "사업계획서", { priority: "medium" });
      mkTask("사업계획서 팀 미팅", semester, "사업계획서");

      // 마케팅
      mkTask("마케팅 전략 보고서", semester, "마케팅", { priority: "high" });
      mkTask("마케팅 사례 분석", semester, "마케팅");
      mkTask("마케팅 팀 프로젝트", semester, "마케팅", { priority: "medium" });
      mkTask("STP/4P 분석 과제", semester, "마케팅");
      mkTask("마케팅 중간고사", semester, "마케팅", { priority: "high", urgency: "high" });

      // 트렌드분석
      mkTask("트렌드 리포트 작성", semester, "트렌드분석", { priority: "high" });
      mkTask("트렌드 데이터 수집", semester, "트렌드분석");
      mkTask("산업 트렌드 발표", semester, "트렌드분석", { priority: "medium" });
      mkTask("트렌드 분석 기말 과제", semester, "트렌드분석", { priority: "high" });

      // 사고력
      mkTask("비판적 사고 에세이", semester, "사고력", { priority: "medium" });
      mkTask("논리적 사고 워크시트", semester, "사고력");
      mkTask("사고력 토론 준비", semester, "사고력");
      mkTask("사고력 기말시험", semester, "사고력", { priority: "high" });

      // 기획
      mkTask("기획서 작성 실습", semester, "기획", { priority: "high" });
      mkTask("기획 프레젠테이션", semester, "기획", { priority: "medium" });
      mkTask("기획 팀 프로젝트", semester, "기획");
      mkTask("기획안 피드백 반영", semester, "기획");

      // HRD
      mkTask("HRD 개론 레포트", semester, "HRD");
      mkTask("인적자원개발 사례분석", semester, "HRD", { priority: "medium" });
      mkTask("HRD 팀 과제", semester, "HRD");
      mkTask("HRD 기말 시험", semester, "HRD", { priority: "high" });

      // 데이터분석
      mkTask("데이터 수집/정제 실습", semester, "데이터분석", { priority: "high" });
      mkTask("통계 분석 과제", semester, "데이터분석");
      mkTask("데이터 시각화 프로젝트", semester, "데이터분석", { priority: "medium" });
      mkTask("데이터분석 기말 프로젝트", semester, "데이터분석", { priority: "high" });

      // 창업론
      mkTask("창업 아이디어 피칭", semester, "창업론", { priority: "high" });
      mkTask("린 스타트업 방법론 과제", semester, "창업론");
      mkTask("비즈니스 모델 캔버스", semester, "창업론", { priority: "medium" });

      // === Folder Links (수업 간 연결, 수업↔사업, 수업↔R&D) ===
      d.folderLinks.push(
        { id: uid(), fromFolderId: semester.id, toFolderId: biz.id, label: "사업계획서↔창업" },
        { id: uid(), fromFolderId: semester.id, toFolderId: rnd.id, label: "데이터분석↔연구" },
        { id: uid(), fromFolderId: semester.id, toFolderId: external.id, label: "기획↔대외활동" },
        { id: uid(), fromFolderId: biz.id, toFolderId: rnd.id, label: "사업↔R&D" },
      );
    });
    showToast("아날로그 만다라트 데이터 로드 완료!");
  };

  // === Check all today done ===
  useEffect(() => {
    if (todayList.length > 0 && todayDone === todayList.length) {
      gainXP(50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayDone]);

  const srand = (i: number) => { const x = Math.sin(i * 9301 + 49297) * 49297; return x - Math.floor(x); };

  const tabs = [
    { key: "home", label: "홈", icon: "◈" },
    { key: "staging", label: "쏟아내기", icon: "📥", badge: drafts.length || null },
    { key: "mandal", label: "정리", icon: "▦" },
    { key: "coach", label: "코칭", icon: "🧠" },
  ];

  // Scheduled vs unscheduled today tasks
  const scheduledTasks = todayList.filter(t => t.timeSlot);
  const unscheduledTasks = todayList.filter(t => !t.timeSlot);

  // Onboarding current step data
  const obStep = onboardStep < ONBOARDING_STEPS.length ? ONBOARDING_STEPS[onboardStep] : null;
  const obQuestion = obStep?.question || aiOnboardQ?.question || "";
  const obOptions = obStep?.options || aiOnboardQ?.options || [];
  const obIsMulti = obStep?.multi || false;
  const obProgress = Math.min(100, ((onboardStep) / (ONBOARDING_STEPS.length + 2)) * 100);

  // === ONBOARDING SCREEN ===
  if (showOnboarding) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${C.primaryLight}, ${C.violetLight})`, fontFamily: "-apple-system, 'Pretendard', 'Malgun Gothic', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 440, background: C.surface, borderRadius: 20, padding: "32px 28px", boxShadow: "0 8px 40px rgba(99,102,241,.15)" }}>

          {/* Progress */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
            <span style={{ fontSize: 24 }}>◈</span>
            <div style={{ flex: 1, height: 4, background: C.surfaceAlt, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${obProgress}%`, background: `linear-gradient(90deg, ${C.primary}, ${C.violet})`, borderRadius: 2, transition: "width .4s ease" }} />
            </div>
            <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>{onboardStep + 1}/{ONBOARDING_STEPS.length + 2}</span>
          </div>

          {/* Chat-like display of previous answers */}
          {onboardAnswers.length > 0 && (
            <div style={{ maxHeight: 160, overflowY: "auto", marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
              {onboardAnswers.slice(-3).map((a, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontSize: 10, color: C.textMuted }}>{a.question}</div>
                  <div style={{ alignSelf: "flex-end", background: C.primaryLight, color: C.primary, padding: "4px 12px", borderRadius: "12px 12px 2px 12px", fontSize: 13, fontWeight: 600 }}>{a.answer}</div>
                </div>
              ))}
            </div>
          )}

          {/* Current question */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 20 }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>🤖</span>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: C.text, lineHeight: 1.5, margin: 0 }}>{obQuestion || "잠시만요..."}</p>
              {obIsMulti && <p style={{ fontSize: 11, color: C.textMuted, margin: "4px 0 0" }}>여러 개 선택 가능</p>}
            </div>
          </div>

          {/* Options */}
          {obOptions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              {obOptions.map((opt, i) => {
                const selected = obIsMulti ? onboardMultiSel.has(opt) : false;
                return (
                  <button key={i} onClick={() => {
                    if (obIsMulti) {
                      setOnboardMultiSel(prev => { const n = new Set(prev); n.has(opt) ? n.delete(opt) : n.add(opt); return n; });
                    } else {
                      answerOnboarding(opt);
                    }
                  }}
                    style={{
                      padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
                      textAlign: "left", transition: "all .15s",
                      background: selected ? C.primaryLight : C.surfaceAlt,
                      border: `2px solid ${selected ? C.primary : "transparent"}`,
                      color: selected ? C.primary : C.text,
                    }}
                  >
                    {obIsMulti && <span style={{ marginRight: 8 }}>{selected ? "✓" : "○"}</span>}
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {/* Multi-select confirm */}
          {obIsMulti && onboardMultiSel.size > 0 && (
            <Btn variant="primary" onClick={() => answerOnboarding([...onboardMultiSel].join(", "))} style={{ width: "100%", marginBottom: 12 }}>
              선택 완료 ({onboardMultiSel.size}개)
            </Btn>
          )}

          {/* Free text input */}
          <div style={{ display: "flex", gap: 6 }}>
            <input value={onboardInput} onChange={e => setOnboardInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && onboardInput.trim()) answerOnboarding(onboardInput.trim()); }}
              placeholder="직접 입력..."
              style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14 }} />
            {onboardInput.trim() && (
              <Btn variant="primary" onClick={() => answerOnboarding(onboardInput.trim())}>→</Btn>
            )}
          </div>

          {/* Skip */}
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button onClick={() => { completeOnboarding(onboardAnswers); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 12 }}>
              나중에 할게요 (건너뛰기)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, 'Pretendard', 'Malgun Gothic', sans-serif", color: C.text, display: "flex", flexDirection: "column" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 200, padding: "8px 20px", borderRadius: 10, background: aiLoading ? C.primaryLight : C.accentLight, border: `1px solid ${aiLoading ? C.primaryBorder : C.accentBorder}`, color: aiLoading ? "#4338CA" : "#065F46", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,.1)" }}>
          {aiLoading && "⏳ "}{toast}
        </div>
      )}

      {/* XP Toast */}
      {xpToast && (
        <div style={{ position: "fixed", top: 56, left: "50%", transform: "translateX(-50%)", zIndex: 201, padding: "4px 14px", borderRadius: 8, background: "#FDE68A", color: "#92400E", fontSize: 12, fontWeight: 700, boxShadow: "0 2px 10px rgba(0,0,0,.1)", animation: "fadeUp .5s ease" }}>
          {xpToast}
        </div>
      )}

      {/* XP Bar - shown when has content */}
      {hasContent && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 45, background: C.surface, borderBottom: `1px solid ${C.borderLight}`, padding: "6px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{getGrowthIcon(level)}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.primary }}>Lv.{level}</span>
          <div style={{ flex: 1, maxWidth: 120, height: 6, background: C.surfaceAlt, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${xpProgress}%`, background: `linear-gradient(90deg, ${C.primary}, ${C.violet})`, borderRadius: 3, transition: "width .5s ease" }} />
          </div>
          <span style={{ fontSize: 9, color: C.textMuted }}>{xpData.xp}/{nextLevelXP}</span>
          {xpData.streak >= 3 && <span style={{ fontSize: 9, color: C.warm, fontWeight: 700 }}>🔥{xpData.streak}일</span>}
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowSettings(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: C.textMuted }}>⚙</button>
        </div>
      )}

      <main style={{ flex: 1, maxWidth: 720, width: "100%", margin: "0 auto", padding: hasContent ? "40px 16px 100px" : "0 16px 100px" }}>

        {/* ===== HOME ===== */}
        {tab === "home" && (
          <div ref={homeRef}>
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: hasContent ? "flex-start" : "center",
              minHeight: hasContent ? "auto" : "calc(60vh - 60px)",
              paddingTop: hasContent ? 24 : 0, transition: "all .3s ease",
            }}>
              <div style={{ fontSize: hasContent ? 28 : 48, marginBottom: hasContent ? 12 : 24, transition: "all .3s ease", textAlign: "center" }}>
                <span style={{ fontWeight: 800, color: C.primary }}>◈</span>
                {!hasContent && <div style={{ fontSize: 14, color: C.textMuted, marginTop: 8, fontWeight: 500 }}>머릿속을 비우세요. 나머지는 만다라트가 합니다.</div>}
              </div>

              <div style={{ width: "100%", maxWidth: hasContent ? 600 : 520, transition: "all .3s ease", position: "relative" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: C.surface, borderRadius: 24,
                  border: `2px solid ${inputFocused ? C.primary : C.border}`,
                  boxShadow: inputFocused ? "0 4px 20px rgba(99,102,241,.15)" : "0 2px 8px rgba(0,0,0,.04)",
                  padding: "4px 6px 4px 20px", transition: "all .2s",
                }}>
                  <input ref={inputRef} value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitInput(); } }}
                    onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)}
                    placeholder={hasContent ? "더 쏟아내세요..." : "할 일, 생각, 아이디어를 쏟아내세요"}
                    style={{ flex: 1, padding: "14px 0", fontSize: 16, border: "none", outline: "none", background: "transparent", color: C.text }}
                  />
                  {aiLoading && <span style={{ fontSize: 18, animation: "spin 1s linear infinite" }}>⏳</span>}
                  <button onClick={submitInput} style={{
                    background: C.primary, color: "#fff", border: "none", borderRadius: 20,
                    padding: "10px 20px", cursor: "pointer", fontWeight: 700, fontSize: 14,
                  }}>추가</button>
                </div>
                <p style={{ textAlign: "center", fontSize: 11, color: C.textMuted, marginTop: 8 }}>
                  {hasContent ? "#주제, #주제 > 할일, 일반 할일 — 쉼표로 여러 개 · AI 자동분류" : "#주제명 → 폴더 생성 · #주제 > 할일 → 바로 배치 · 쉼표로 여러 개"}
                </p>
              </div>

              {!hasContent && (
                <div style={{ textAlign: "center", marginTop: 40 }}>
                  <button onClick={() => setShowSettings(true)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 13 }}>⚙ 설정</button>
                </div>
              )}
            </div>

            {/* AI Questions */}
            {aiQuestions.length > 0 && (
              <div style={{ marginTop: 20, marginBottom: 16 }}>
                {aiQuestions.map(q => (
                  <div key={q.id} style={{ background: C.violetLight, border: `1.5px solid ${C.violetBorder}`, borderRadius: 14, padding: 16, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>🤖</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "#6D28D9", marginBottom: 10, lineHeight: 1.5 }}>{q.text}</p>
                        {q.options ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {q.options.map((opt, i) => (
                              <button key={i} onClick={() => answerAiQuestion(q.id, opt)}
                                style={{ padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${C.violetBorder}`, background: "#fff", color: "#6D28D9", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                              >{opt}</button>
                            ))}
                          </div>
                        ) : (
                          <input placeholder="답변 입력..." style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${C.violetBorder}`, fontSize: 13, boxSizing: "border-box" }}
                            onKeyDown={e => { if (e.key === "Enter") answerAiQuestion(q.id, (e.target as HTMLInputElement).value); }}
                          />
                        )}
                      </div>
                      <button onClick={() => setAiQuestions(prev => prev.filter(x => x.id !== q.id))} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 16 }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Word Cloud with clusters */}
            {hasContent && (
              <div style={{ marginTop: 16, marginBottom: 24 }}>
                <SectionHeader icon="☁️" title="키워드 클라우드" sub={`${categories.length}개 카테고리 · ${data.tasks.length}개 항목 · ${data.clusters.length}개 클러스터`}
                  right={
                    <div className="no-print" style={{ display: "flex", gap: 4 }}>
                      <Btn variant={selectMode ? "primary" : "default"} onClick={() => { setSelectMode(!selectMode); setSelectedAtoms(new Set()); setConnectMode(false); }} style={{ padding: "4px 10px", fontSize: 11 }}>
                        {selectMode ? "✓ 선택중" : "묶기"}
                      </Btn>
                      <Btn variant={connectMode ? "warm" : "default"} onClick={() => { setConnectMode(!connectMode); setConnectFrom(null); setSelectMode(false); }} style={{ padding: "4px 10px", fontSize: 11 }}>
                        {connectMode ? "✓ 연결중" : "연결"}
                      </Btn>
                      {selectedAtoms.size >= 2 && <Btn variant="accent" onClick={mergeSelected} style={{ padding: "4px 10px", fontSize: 11 }}>병합 ({selectedAtoms.size})</Btn>}
                      <Btn variant="violet" onClick={generateEvolutionQuestion} disabled={aiLoading} style={{ padding: "4px 10px", fontSize: 11 }}>🤖</Btn>
                      <Btn onClick={() => homeRef.current && exportAsImage(homeRef.current, "만다라트.png")} style={{ padding: "4px 10px", fontSize: 11 }}>📷</Btn>
                    </div>
                  }
                />

                {/* Clusters */}
                {data.clusters.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    {data.clusters.map(cl => {
                      const clTasks = cl.taskIds.map(id => data.tasks.find(t => t.id === id)).filter(Boolean) as Task[];
                      const mainCat = clTasks[0]?.category;
                      const cc = mainCat ? getCategoryColor(mainCat) : { bg: C.surfaceAlt, text: C.text, border: C.border };
                      return (
                        <div key={cl.id} style={{
                          background: cc.bg, borderRadius: 14, padding: "10px 14px",
                          border: `2px solid ${cc.border}`, position: "relative", minWidth: 120,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: cc.text }}>{cl.label}</span>
                            <span style={{ fontSize: 10, color: cc.text, opacity: .6 }}>({clTasks.length})</span>
                            <button onClick={() => unmergeCluster(cl.id)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 10, color: C.textMuted }}>해체</button>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {clTasks.map(t => (
                              <span key={t.id} style={{
                                fontSize: 11, padding: "2px 6px", borderRadius: 6, background: "rgba(255,255,255,.7)",
                                color: cc.text, fontWeight: 500, cursor: "pointer",
                              }}
                                onClick={() => { setSelTaskId(t.id); setShowDetail(true); }}
                              >{t.text}</span>
                            ))}
                          </div>
                          {/* Connections from this cluster */}
                          {data.connections.filter(cn => cl.taskIds.includes(cn.fromId) || cl.taskIds.includes(cn.toId)).length > 0 && (
                            <div style={{ fontSize: 9, color: cc.text, opacity: .5, marginTop: 4 }}>
                              🔗 {data.connections.filter(cn => cl.taskIds.includes(cn.fromId) || cl.taskIds.includes(cn.toId)).length}개 연결
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Category cluster cloud */}
                {categories.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {categories.map(cat => {
                      const catTasks = data.tasks.filter(t => t.category === cat && !t.clusterId);
                      if (catTasks.length === 0) return null;
                      const cc = getCategoryColor(cat);
                      return (
                        <div key={cat} style={{ background: cc.bg, borderRadius: 14, padding: "12px 16px", border: `1.5px solid ${cc.border}` }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: cc.text, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: cc.text }} />
                            {cat}
                            <span style={{ fontWeight: 400, opacity: .6 }}>({catTasks.length})</span>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", alignItems: "center" }}>
                            {catTasks.map(t => {
                              const isDone = t.status === "done" || t.status === "reflect";
                              const isSelected = selectedAtoms.has(t.id);
                              const isConnectTarget = connectMode && connectFrom === t.id;
                              const hasConn = data.connections.some(cn => cn.fromId === t.id || cn.toId === t.id);
                              const fontSize = Math.max(12, Math.min(24, 14 + (t.priority === "high" ? 6 : t.priority === "medium" ? 3 : 0)));
                              return (
                                <span key={t.id} draggable={!selectMode && !connectMode}
                                  onDragStart={e => { e.dataTransfer.setData("text/plain", t.id); setDragId(t.id); }}
                                  onDragEnd={() => setDragId(null)}
                                  onClick={() => {
                                    if (selectMode) {
                                      setSelectedAtoms(prev => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; });
                                    } else if (connectMode) {
                                      toggleConnection(t.id);
                                    } else {
                                      setSelTaskId(t.id); setShowDetail(true);
                                    }
                                  }}
                                  style={{
                                    fontSize, color: cc.text, fontWeight: t.priority === "high" ? 800 : 600,
                                    opacity: isDone ? 0.35 : 0.9, cursor: "pointer",
                                    textDecoration: isDone ? "line-through" : "none",
                                    transition: "all .15s", padding: "1px 3px",
                                    background: isSelected ? "rgba(99,102,241,.2)" : isConnectTarget ? "rgba(245,158,11,.2)" : "transparent",
                                    borderRadius: isSelected || isConnectTarget ? 6 : 0,
                                    outline: isSelected ? `2px solid ${C.primary}` : isConnectTarget ? `2px solid ${C.warm}` : "none",
                                    position: "relative",
                                  }}
                                  onMouseEnter={e => { if (!selectMode && !connectMode) e.currentTarget.style.transform = "scale(1.12)"; }}
                                  onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
                                >
                                  {hasConn && <span style={{ position: "absolute", top: -4, right: -4, fontSize: 8 }}>🔗</span>}
                                  {t.text}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* Uncategorized */}
                    {data.tasks.filter(t => !t.category && !t.clusterId).length > 0 && (
                      <div style={{ background: C.surfaceAlt, borderRadius: 14, padding: "12px 16px", border: `1.5px solid ${C.border}` }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, marginBottom: 8 }}>미분류 ({data.tasks.filter(t => !t.category && !t.clusterId).length})</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px" }}>
                          {data.tasks.filter(t => !t.category && !t.clusterId).map(t => (
                            <span key={t.id} onClick={() => {
                              if (selectMode) { setSelectedAtoms(prev => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; }); }
                              else if (connectMode) { toggleConnection(t.id); }
                              else { setSelTaskId(t.id); setShowDetail(true); }
                            }}
                              style={{
                                fontSize: 13, color: C.textMuted, cursor: "pointer", padding: "1px 3px", fontWeight: 500,
                                background: selectedAtoms.has(t.id) ? "rgba(99,102,241,.2)" : "transparent",
                                borderRadius: selectedAtoms.has(t.id) ? 6 : 0,
                                outline: selectedAtoms.has(t.id) ? `2px solid ${C.primary}` : "none",
                              }}
                            >{t.text}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: "24px 16px", display: "flex", flexWrap: "wrap", gap: "6px 12px", alignItems: "center", justifyContent: "center" }}>
                    {data.tasks.map((t, i) => (
                      <span key={t.id} draggable
                        onDragStart={e => { e.dataTransfer.setData("text/plain", t.id); setDragId(t.id); }}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => { setSelTaskId(t.id); setShowDetail(true); }}
                        style={{
                          fontSize: Math.max(13, Math.min(28, 15 + (srand(i) * 10))),
                          color: [C.primary, C.violet, C.accent, "#4338CA", "#0891B2"][Math.floor(srand(i) * 5)],
                          fontWeight: 600, cursor: "pointer", padding: "2px 4px", transition: "transform .15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.15)"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
                      >{t.text}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Mini mandal-art maps */}
            {data.folders.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <SectionHeader icon="◈" title="만다라트" sub="클릭하면 상세" />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                  {data.folders.map(f => {
                    const cells = data.cells.filter(c => c.boardId === f.rootBoardId).sort((a, b) => a.position - b.position);
                    return (
                      <div key={f.id} onClick={() => openFolder(f)}
                        onDragOver={e => e.preventDefault()} onDrop={() => dropFolder(f.id)}
                        style={{
                          background: C.surface, borderRadius: 12, border: dragId ? `2px dashed ${C.primary}` : `1px solid ${C.border}`,
                          padding: 12, cursor: "pointer", transition: "all .15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(99,102,241,.1)"; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.primary }} />
                          {f.title}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
                          {cells.map(cell => (
                            <div key={cell.id} style={{
                              background: cell.position === 4 ? C.primaryLight : cell.text ? C.surfaceAlt : "#F8FAFC",
                              border: cell.position === 4 ? `1px solid ${C.primary}` : `1px solid ${C.borderLight}`,
                              borderRadius: 4, padding: "4px 2px", textAlign: "center", minHeight: 24,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {cell.text ? <div style={{ fontSize: 8, fontWeight: cell.position === 4 ? 700 : 400, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cell.text}</div>
                                : <div style={{ width: 3, height: 3, borderRadius: "50%", background: C.borderLight }} />}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== STAGING ===== */}
        {tab === "staging" && (
          <div style={{ paddingTop: 20 }}>
            <SectionHeader icon="📥" title="쏟아내기" sub="전부 꺼내세요 — AI가 정리합니다"
              right={drafts.length > 0 && <Btn variant="primary" onClick={() => aiClassifyTasks(drafts.map(t => t.text))} disabled={aiLoading} style={{ padding: "5px 10px", fontSize: 11 }}>{aiLoading ? "⏳" : "🤖"} AI 분류</Btn>}
            />
            {data.tasks.length > 0 && (
              <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>정렬</span>
                {["none", "priority", "urgency", "importance"].map(s => (
                  <button key={s} onClick={() => setSortBy(s)} style={{
                    padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: "pointer",
                    background: sortBy === s ? C.primary : C.surface, color: sortBy === s ? "#fff" : C.textMuted,
                    border: `1px solid ${sortBy === s ? C.primary : C.border}`,
                  }}>{{ none: "기본", priority: "우선순위", urgency: "시급성", importance: "중요도" }[s]}</button>
                ))}
                <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, marginLeft: 6 }}>필터</span>
                {["all", "high", "medium", "low"].map(f => (
                  <button key={f} onClick={() => setFilterPriority(f)} style={{
                    padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: "pointer",
                    background: filterPriority === f ? C.primaryLight : C.surface, color: filterPriority === f ? C.primary : C.textMuted,
                    border: `1px solid ${filterPriority === f ? C.primaryBorder : C.border}`,
                  }}>{{ all: "전체", high: "🔴", medium: "🟡", low: "🟢" }[f]}</button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {sortTasks(data.tasks).map(t => {
                const cc = t.category ? getCategoryColor(t.category) : null;
                return (
                  <div key={t.id} draggable onDragStart={e => { e.dataTransfer.setData("text/plain", t.id); setDragId(t.id); }} onDragEnd={() => setDragId(null)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, cursor: "grab" }}>
                    <span style={{ color: C.textMuted, fontSize: 12 }}>⠿</span>
                    {cc && <span style={{ width: 6, height: 6, borderRadius: "50%", background: cc.text, flexShrink: 0 }} />}
                    <span style={{ flex: 1, fontSize: 13, textDecoration: (t.status === "done" || t.status === "reflect") ? "line-through" : "none", color: (t.status === "done" || t.status === "reflect") ? C.textMuted : C.text }}>{t.text}</span>
                    {t.category && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: cc?.bg, color: cc?.text, fontWeight: 600 }}>{t.category}</span>}
                    {t.deadline && (() => { const days = Math.ceil((new Date(t.deadline).getTime() - Date.now()) / 86400000); const color = days < 0 ? C.rose : days <= 3 ? "#F59E0B" : "#065F46"; return <span style={{ fontSize: 9, fontWeight: 700, color }}>{days < 0 ? `${-days}일↑` : `D-${days}`}</span>; })()}
                    <PriorityBadge level={t.priority} />
                    <button onClick={() => { setSelTaskId(t.id); setShowDetail(true); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}>⋯</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== MANDAL-ART ===== */}
        {tab === "mandal" && (
          <div style={{ paddingTop: 20 }}>
            {!curBoardId ? (
              <div>
                <SectionHeader icon="▦" title="정리하기" sub="폴더를 선택하거나 만들기" right={<Btn onClick={() => setShowNewFolder(true)}>+ 새 폴더</Btn>} />
                {showNewFolder && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <input value={newFolder} onChange={e => setNewFolder(e.target.value)} onKeyDown={e => e.key === "Enter" && createFolderAction()} placeholder="폴더 이름" autoFocus
                      style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 14 }} />
                    <Btn variant="primary" onClick={createFolderAction}>생성</Btn>
                    <Btn variant="ghost" onClick={() => setShowNewFolder(false)}>취소</Btn>
                  </div>
                )}
                {/* Word cloud on folder list - drag to folders */}
                {drafts.length > 0 && (() => {
                  const maxLen = Math.max(...drafts.map(t => t.text.length), 1);
                  const minFont = 13, maxFont = 24;
                  const cloudColors = ["#6366F1", "#10B981", "#F59E0B", "#F43F5E", "#8B5CF6", "#0EA5E9", "#D946EF", "#F97316", "#14B8A6", "#EC4899"];
                  const hashNum = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h); };
                  return (
                    <div style={{
                      background: `linear-gradient(145deg, #FAFBFF, ${C.primaryLight}50, ${C.violetLight}30)`,
                      borderRadius: 18, padding: "16px 14px 14px", marginBottom: 14,
                      border: `1.5px solid ${C.primaryBorder}`,
                      boxShadow: "0 2px 12px rgba(99,102,241,.06)", animation: "fadeSlideUp .3s ease",
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 15, filter: "drop-shadow(0 1px 2px rgba(99,102,241,.3))" }}>☁️</span>
                        워드클라우드
                        <span style={{ background: C.primary, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{drafts.length}</span>
                        <span style={{ color: C.textMuted, fontWeight: 400, fontSize: 10, marginLeft: 4 }}>폴더로 드래그하여 분류</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "8px 6px", minHeight: 50, padding: "4px 0" }}>
                        {drafts.map((t, idx) => {
                          const h = hashNum(t.id);
                          const sizeVar = (h % 100) / 100;
                          const fontSize = minFont + (1 - (t.text.length / maxLen) * 0.3) * (maxFont - minFont) * (0.45 + sizeVar * 0.55);
                          const color = cloudColors[h % cloudColors.length];
                          const rotate = ((h % 13) - 6);
                          return (
                            <span key={t.id} className="cloud-word" draggable
                              onDragStart={e => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; setDragId(t.id); }}
                              onDragEnd={() => setDragId(null)}
                              onClick={() => { setSelTaskId(t.id); setShowDetail(true); }}
                              style={{
                                ["--rot" as any]: `${rotate}deg`,
                                fontSize: Math.round(fontSize), fontWeight: fontSize > 18 ? 800 : fontSize > 14 ? 700 : 600,
                                color, cursor: "grab", padding: "3px 8px", borderRadius: 8,
                                transform: `rotate(${rotate}deg)`,
                                opacity: dragId === t.id ? 0.2 : 1,
                                background: dragId === t.id ? color + "12" : "transparent",
                                whiteSpace: "nowrap", userSelect: "none",
                                display: "inline-flex", alignItems: "center", gap: 3,
                                animation: `cloudPop .4s cubic-bezier(.34,1.56,.64,1) ${idx * 0.05}s both`,
                                textShadow: `0 1px 3px ${color}20`,
                              }}
                            >
                              {t.text}
                              <button className="cloud-trash" onClick={e => { e.stopPropagation(); delTask(t.id); }}
                                style={{ fontSize: 9, background: "none", border: "none", cursor: "pointer", color: C.textMuted, opacity: 0, padding: 0, lineHeight: 1, marginLeft: 1, transition: "all .15s" }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = "0"; }}
                              >✕</button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                  {data.folders.map(f => (
                    <div key={f.id} onDragOver={e => { e.preventDefault(); e.currentTarget.style.boxShadow = `0 0 0 3px ${C.primary}40`; }}
                      onDragLeave={e => { e.currentTarget.style.boxShadow = "none"; }}
                      onDrop={e => { e.currentTarget.style.boxShadow = "none"; dropFolder(f.id); }}
                      style={{ background: f.color, borderRadius: 12, padding: "16px 12px", cursor: "pointer", border: dragId ? `2px dashed ${C.primary}` : `1.5px solid transparent`, position: "relative", transition: "box-shadow .15s" }}>
                      <div onClick={() => openFolder(f)}>
                        <div style={{ fontSize: 22, marginBottom: 4 }}>📁</div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{f.title}</div>
                        <div style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>{data.tasks.filter(t => t.folderId === f.id).length}개</div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); if (confirm(`"${f.title}" 해체? 하위 항목은 자유 atom으로 돌아갑니다.`)) dissolveFolder(f.id); }}
                        style={{ position: "absolute", top: 6, right: 6, background: "rgba(255,255,255,.7)", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 10, color: C.textMuted, padding: "2px 4px" }}
                        title="주제 해체">↩</button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Btn variant="ghost" onClick={goBack} style={{ padding: "3px 8px", fontSize: 12 }}>←</Btn>
                    {breadcrumb().map((cr, i) => (
                      <span key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        {i > 0 && <span style={{ color: C.textMuted, fontSize: 10 }}>/</span>}
                        <button onClick={() => setBoardPath(p => p.slice(0, cr.idx + 1))} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: i === breadcrumb().length - 1 ? 700 : 500, color: i === breadcrumb().length - 1 ? C.text : C.textSub, fontSize: 13 }}>{cr.label}</button>
                      </span>
                    ))}
                  </div>
                  <div className="no-print" style={{ display: "flex", gap: 4 }}>
                    <Btn onClick={() => mandalRef.current && exportAsImage(mandalRef.current, "만다라트.png")} style={{ padding: "4px 8px", fontSize: 10 }}>📷</Btn>
                    <Btn onClick={() => window.print()} style={{ padding: "4px 8px", fontSize: 10 }}>🖨️</Btn>
                  </div>
                </div>
                {data.folders.length > 1 && (
                  <div style={{ display: "flex", gap: 4, marginBottom: 8, overflowX: "auto" }}>
                    {data.folders.map(f => (
                      <button key={f.id} onClick={() => openFolder(f)}
                        style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: selFolderId === f.id ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap",
                          background: selFolderId === f.id ? C.primary : f.color, color: selFolderId === f.id ? "#fff" : C.text, border: `1px solid ${selFolderId === f.id ? C.primary : C.border}` }}>
                        {f.title}
                      </button>
                    ))}
                  </div>
                )}
                {(() => {
                  const cloudItems = drafts;
                  const maxLen = Math.max(...cloudItems.map(t => t.text.length), 1);
                  const minFont = 13, maxFont = 26;
                  const cloudColors = ["#6366F1", "#10B981", "#F59E0B", "#F43F5E", "#8B5CF6", "#0EA5E9", "#D946EF", "#F97316", "#14B8A6", "#EC4899"];
                  const hashNum = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h); };
                  return (
                    <div style={{
                      background: `linear-gradient(145deg, #FAFBFF, ${C.primaryLight}50, ${C.violetLight}30)`,
                      borderRadius: 18, padding: "16px 14px 14px", marginBottom: 12,
                      border: `1.5px solid ${C.primaryBorder}`, position: "relative",
                      boxShadow: "0 2px 12px rgba(99,102,241,.06)",
                      animation: "fadeSlideUp .3s ease",
                    }}>
                      {/* Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ fontSize: 15, filter: "drop-shadow(0 1px 2px rgba(99,102,241,.3))" }}>☁️</span>
                          워드클라우드
                          {cloudItems.length > 0 && <span style={{ background: C.primary, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{cloudItems.length}</span>}
                        </div>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <button onClick={() => { setCellInputId("_cloud_add"); setCellInputText(""); }}
                            style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${C.accentBorder}`, background: C.accentLight, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", color: C.accent, fontWeight: 700, transition: "all .15s" }}
                            title="새 항목 추가">+</button>
                        </div>
                      </div>

                      {/* Inline add */}
                      {cellInputId === "_cloud_add" && (
                        <div style={{ display: "flex", gap: 6, marginBottom: 10, animation: "fadeSlideUp .2s ease" }}>
                          <input value={cellInputText} onChange={e => setCellInputText(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter" && cellInputText.trim()) {
                                const text = cellInputText.trim();
                                up(d => {
                                  const task: Task = { id: uid(), text, status: "draft", memo: "", folderId: null, boardId: null, cellPosition: null, completedAt: null, toReflect: false, _today: false, priority: null, urgency: null, importance: null, category: null, timeSlot: null, clusterId: null, deadline: null };
                                  d.tasks.push(task);
                                });
                                setCellInputText("");
                              }
                              if (e.key === "Escape") setCellInputId(null);
                            }}
                            onBlur={() => { if (!cellInputText.trim()) setCellInputId(null); }}
                            autoFocus placeholder="새 키워드 입력... (Enter로 추가)"
                            style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${C.accentBorder}`, fontSize: 13, background: "#fff", outline: "none" }} />
                        </div>
                      )}

                      {/* Cloud words */}
                      {cloudItems.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "8px 6px", minHeight: 60, padding: "6px 0" }}>
                          {cloudItems.map((t, idx) => {
                            const h = hashNum(t.id);
                            const sizeVar = (h % 100) / 100;
                            const fontSize = minFont + (1 - (t.text.length / maxLen) * 0.3) * (maxFont - minFont) * (0.45 + sizeVar * 0.55);
                            const color = cloudColors[h % cloudColors.length];
                            const rotate = ((h % 13) - 6);
                            return (
                              <span key={t.id} className="cloud-word" draggable
                                onDragStart={e => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; setDragId(t.id); }}
                                onDragEnd={() => setDragId(null)}
                                onClick={() => { setSelTaskId(t.id); setShowDetail(true); }}
                                style={{
                                  ["--rot" as any]: `${rotate}deg`,
                                  fontSize: Math.round(fontSize), fontWeight: fontSize > 18 ? 800 : fontSize > 14 ? 700 : 600,
                                  color, cursor: "grab", padding: "3px 8px", borderRadius: 8,
                                  transform: `rotate(${rotate}deg)`,
                                  opacity: dragId === t.id ? 0.2 : 1,
                                  background: dragId === t.id ? color + "12" : "transparent",
                                  whiteSpace: "nowrap", userSelect: "none",
                                  position: "relative", display: "inline-flex", alignItems: "center", gap: 3,
                                  animation: `cloudPop .4s cubic-bezier(.34,1.56,.64,1) ${idx * 0.05}s both`,
                                  textShadow: `0 1px 3px ${color}20`,
                                }}
                              >
                                {t.text}
                                <button className="cloud-trash" onClick={e => { e.stopPropagation(); delTask(t.id); }}
                                  style={{ fontSize: 9, background: "none", border: "none", cursor: "pointer", color: C.textMuted, opacity: 0, padding: 0, lineHeight: 1, marginLeft: 1, transition: "all .15s" }}
                                  onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
                                  onMouseLeave={e => { e.currentTarget.style.opacity = "0"; }}
                                >✕</button>
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ textAlign: "center", padding: "20px 0", color: C.textMuted, fontSize: 12 }}>
                          <div style={{ fontSize: 24, marginBottom: 6, opacity: 0.4 }}>☁️</div>
                          위에서 쏟아낸 항목이 여기 나타나요
                        </div>
                      )}

                      {/* Subtle hint */}
                      {cloudItems.length > 0 && (
                        <div style={{ textAlign: "center", fontSize: 10, color: C.textMuted, marginTop: 6, opacity: 0.6 }}>
                          아래 셀로 드래그하여 배치하세요
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* === View Mode Segment Control === */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                  <div style={{ display: "inline-flex", background: C.surfaceAlt, borderRadius: 10, padding: 3, gap: 2 }}>
                    {([["mandal", "만다라트"], ["matrix", "매트릭스"]] as const).map(([key, label]) => (
                      <button key={key} className="seg-btn" onClick={() => setViewMode(key as any)}
                        style={{
                          padding: "7px 18px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                          background: viewMode === key ? C.surface : "transparent",
                          color: viewMode === key ? C.primary : C.textMuted,
                          border: "none",
                          boxShadow: viewMode === key ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                        }}>{label}</button>
                    ))}
                  </div>
                </div>

                {/* === Trash Zone === */}
                {dragId && (
                  <div
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.borderColor = C.rose; }}
                    onDragLeave={e => { e.currentTarget.style.background = C.surfaceAlt; e.currentTarget.style.borderColor = C.border; }}
                    onDrop={e => { e.preventDefault(); e.currentTarget.style.background = C.surfaceAlt; if (dragId) delTask(dragId); setDragId(null); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      padding: "10px 0", marginBottom: 10, borderRadius: 12,
                      border: `2px dashed ${C.border}`, background: C.surfaceAlt,
                      fontSize: 12, color: C.textMuted, fontWeight: 500,
                      animation: "appleFadeIn .2s cubic-bezier(.25,.46,.45,.94)",
                      transition: "all .2s cubic-bezier(.25,.46,.45,.94)",
                    }}>
                    <span style={{ fontSize: 16 }}>🗑</span> 여기에 놓으면 삭제
                  </div>
                )}

                {viewMode === "mandal" ? (<>
                {boardPath.length === 1 ? (
                  /* ===== 9x9 Mandal-Art Expanded View ===== */
                  (() => {
                    const rootCells = data.cells.filter(c => c.boardId === curBoardId).sort((a, b) => a.position - b.position);
                    const subGrids = [0,1,2,3,4,5,6,7,8].map(outerPos => {
                      if (outerPos === 4) return { pos: 4, cells: rootCells, rootCell: null as Cell | null, childBoardId: curBoardId };
                      const rootCell = rootCells.find(c => c.position === outerPos) || null;
                      const cbId = rootCell?.childBoardId || null;
                      const childCells = cbId ? data.cells.filter(c => c.boardId === cbId).sort((a, b) => a.position - b.position) : [];
                      return { pos: outerPos, cells: childCells, rootCell, childBoardId: cbId };
                    });

                    const renderMiniCell = (cell: Cell, outerPos: number, isRootGrid: boolean) => {
                      const isCellCenter = cell.position === 4;
                      const hasText = !!cell.text;
                      const pc = posTheme[outerPos];
                      const rootPc = isRootGrid && !isCellCenter ? posTheme[cell.position] : null;

                      // Cell background color
                      let cellBg = hasText ? C.surface : C.surfaceAlt + "90";
                      if (isCellCenter && isRootGrid) cellBg = `linear-gradient(135deg, ${C.primaryLight}, #E0E7FF)`;
                      else if (isCellCenter && !isRootGrid && pc) cellBg = pc.fill;
                      else if (isRootGrid && rootPc) cellBg = rootPc.fill + "60";

                      // Tooltip info
                      const linkedTasks = cell.linkedTaskIds.map(id => data.tasks.find(t => t.id === id)).filter(Boolean) as Task[];

                      // For center cell of sub-grid: show sibling cells (same board, other positions)
                      // For non-center cells: show child board contents
                      let tooltipCells: Cell[] = [];
                      if (isCellCenter && !isRootGrid) {
                        // Show sibling cells from same board
                        tooltipCells = data.cells.filter(c => c.boardId === cell.boardId && c.position !== 4 && c.text).sort((a, b) => a.position - b.position);
                      } else if (cell.childBoardId) {
                        // Show child board cells
                        tooltipCells = data.cells.filter(c => c.boardId === cell.childBoardId && c.position !== 4 && c.text).sort((a, b) => a.position - b.position);
                      }
                      const hasTooltipContent = tooltipCells.length > 0 || linkedTasks.length > 0;
                      const showTooltip = hasText && !(isCellCenter && isRootGrid) && hasTooltipContent;

                      return (
                        <div key={cell.id} className="mandal-cell mandal-cell-hover"
                          onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = C.primaryLight; e.currentTarget.style.transform = "scale(1.08)"; }}
                          onDragLeave={e => { e.currentTarget.style.background = ""; e.currentTarget.style.transform = ""; }}
                          onDrop={e => {
                            e.preventDefault(); e.currentTarget.style.background = ""; e.currentTarget.style.transform = "";
                            const cellSource = e.dataTransfer.getData("application/x-cell");
                            if (cellSource) { swapCells(cellSource, cell.id); setDragCellId(null); }
                            else dropCell(cell.id);
                          }}
                          onClick={() => {
                            if (cellInputId === cell.id || dragCellId) return;
                            if (isCellCenter && !isRootGrid) {
                              // Click center of outer sub-grid → drill down
                              const sg = subGrids.find(s => s.pos === outerPos);
                              if (sg?.childBoardId) setBoardPath(p => [...p, sg.childBoardId!]);
                            } else if (!hasText && !(isCellCenter && isRootGrid)) {
                              setCellInputId(cell.id); setCellInputText("");
                            } else if (hasText && !isCellCenter) {
                              const lt = cell.linkedTaskIds[0] ? data.tasks.find(t => t.id === cell.linkedTaskIds[0]) : null;
                              if (lt) { setSelTaskId(lt.id); setShowDetail(true); }
                              else { setEditCellId(cell.id); setEditCellText(cell.text); }
                            }
                          }}
                          style={{
                            background: cellBg,
                            borderRadius: 6, aspectRatio: "1/1",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            padding: 2, cursor: "pointer", position: "relative",
                            border: isCellCenter
                              ? (isRootGrid ? `2px solid ${C.primary}60` : `1.5px solid ${pc?.border || C.border}`)
                              : `1px solid ${C.border}25`,
                            animation: dragId && !hasText && !(isCellCenter && isRootGrid) ? "cellPulse 1.5s ease infinite" : "none",
                            transition: "transform .15s, background .15s",
                          }}
                        >
                          {cellInputId === cell.id ? (
                            <input value={cellInputText} onChange={e => setCellInputText(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") commitCellInput(cell.id); if (e.key === "Escape") setCellInputId(null); }}
                              onBlur={() => commitCellInput(cell.id)} autoFocus placeholder=""
                              style={{ width: "95%", padding: 2, borderRadius: 5, border: `1.5px solid ${C.accent}`, fontSize: 10, textAlign: "center", outline: "none" }} />
                          ) : editCellId === cell.id ? (
                            <input value={editCellText} onChange={e => setEditCellText(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && saveCellEdit()} onBlur={saveCellEdit} autoFocus
                              style={{ width: "95%", padding: 2, borderRadius: 5, border: `1.5px solid ${C.primary}`, fontSize: 10, textAlign: "center", outline: "none" }} />
                          ) : hasText ? (
                            <span style={{
                              fontSize: isCellCenter ? (isRootGrid ? 12 : 10) : 9,
                              fontWeight: isCellCenter ? 700 : 500,
                              color: isCellCenter && !isRootGrid ? (pc?.text || C.text) : isCellCenter ? C.primary : C.text,
                              wordBreak: "break-word", lineHeight: 1.15, textAlign: "center",
                              overflow: "hidden", display: "-webkit-box",
                              WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any,
                            }}>{cell.text}</span>
                          ) : (
                            !(isCellCenter && isRootGrid) && (
                              <span style={{ fontSize: dragId ? 11 : 14, color: dragId ? C.primary : C.textMuted, opacity: dragId ? 0.8 : 0.15, fontWeight: 300 }}>
                                {dragId ? "↓" : "+"}
                              </span>
                            )
                          )}

                          {/* Tooltip on hover — shows child board preview */}
                          {showTooltip && (
                            <div className="cell-tooltip" style={{
                              position: "absolute", zIndex: 50, left: "50%", bottom: "calc(100% + 6px)", transform: "translateX(-50%)",
                              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
                              padding: "10px 14px", minWidth: 180, maxWidth: 260,
                              boxShadow: "0 8px 24px rgba(0,0,0,.12)",
                              pointerEvents: "none",
                            }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: pc?.text || C.primary, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                                {cell.text}
                                {cell.childBoardId && <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 400 }}>▸</span>}
                              </div>

                              {/* Board cells preview */}
                              {tooltipCells.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: (!isCellCenter && !cell.childBoardId && linkedTasks.length) ? 6 : 0 }}>
                                  {tooltipCells.map(cc => {
                                    const ccTasks = cc.linkedTaskIds.map(id => data.tasks.find(t => t.id === id)).filter(Boolean) as Task[];
                                    const doneTasks = ccTasks.filter(t => t.status === "done" || t.status === "reflect");
                                    return (
                                      <div key={cc.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                        <span style={{ width: 5, height: 5, borderRadius: 2, background: pc?.fill || C.primaryBorder, flexShrink: 0 }} />
                                        <span style={{ fontSize: 11, color: C.text, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cc.text}</span>
                                        {ccTasks.length > 0 && (
                                          <span style={{ fontSize: 9, color: doneTasks.length === ccTasks.length ? "#059669" : C.textMuted, fontWeight: 600, flexShrink: 0 }}>
                                            {doneTasks.length}/{ccTasks.length}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Direct linked tasks (leaf cell, no child board) */}
                              {!isCellCenter && !cell.childBoardId && linkedTasks.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                  {linkedTasks.map(t => (
                                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.status === "done" ? C.accent : t.status === "placed" ? C.primary : C.warm, flexShrink: 0 }} />
                                      <span style={{ fontSize: 10, color: C.textSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.text}</span>
                                      {t.priority && <span style={{ fontSize: 8, marginLeft: "auto" }}>{priorityMeta[t.priority]?.emoji}</span>}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Arrow */}
                              <div style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%) rotate(45deg)", width: 8, height: 8, background: C.surface, borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }} />
                            </div>
                          )}
                        </div>
                      );
                    };

                    return (
                      <div ref={mandalRef} style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, maxWidth: 680, margin: "0 auto", padding: 4, animation: "appleIn .4s cubic-bezier(.25,.46,.45,.94)" }}>
                        {subGrids.map(sg => {
                          const isRootGrid = sg.pos === 4;
                          const pc = posTheme[sg.pos];
                          return (
                            <div key={sg.pos} className="sub-grid-wrap" style={{
                              background: isRootGrid ? C.surface : (pc?.bg || C.surfaceAlt) + "80",
                              border: isRootGrid ? `2.5px solid ${C.primary}` : `1.5px solid ${pc?.border || C.border}50`,
                              borderRadius: 14, padding: 5,
                              boxShadow: isRootGrid ? "0 4px 16px rgba(99,102,241,.15)" : "0 1px 6px rgba(0,0,0,.03)",
                            }}>
                              <div className="sub-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3 }}>
                                {sg.cells.length === 9
                                  ? sg.cells.map(cell => renderMiniCell(cell, sg.pos, isRootGrid))
                                  : Array.from({length: 9}, (_, i) => (
                                    <div key={i} style={{
                                      background: i === 4 ? (pc?.fill || C.surfaceAlt) + "60" : C.surfaceAlt + "50",
                                      borderRadius: 6, aspectRatio: "1/1", border: `1px solid ${C.border}15`,
                                    }} />
                                  ))
                                }
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                ) : (
                  /* ===== 3x3 Drill-down View ===== */
                  <>
                  <div ref={mandalRef} style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, maxWidth: 400, margin: "0 auto", aspectRatio: "1/1", background: C.bg, padding: 12, borderRadius: 16, boxShadow: "0 1px 8px rgba(0,0,0,.04)" }}>
                    {curCells.map(cell => {
                      const isCenter = cell.position === 4;
                      const linked = cell.linkedTaskIds.map(id => data.tasks.find(t => t.id === id)).filter(Boolean) as Task[];
                      const editing = editCellId === cell.id;
                      const hasText = !!cell.text;
                      const isDraggingThis = dragCellId === cell.id;
                      const allDone = linked.length > 0 && linked.every(t => t.status === "done" || t.status === "reflect");
                      const anyDone = linked.some(t => t.status === "done" || t.status === "reflect");
                      return (
                        <div key={cell.id}
                          draggable={!isCenter && hasText && !editing && cellInputId !== cell.id}
                          onDragStart={e => {
                            if (isCenter || !hasText) { e.preventDefault(); return; }
                            e.dataTransfer.setData("application/x-cell", cell.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDragCellId(cell.id);
                          }}
                          onDragEnd={() => { setDragCellId(null); }}
                          onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = C.primaryLight; }}
                          onDragLeave={e => { e.currentTarget.style.background = isCenter ? C.primaryLight : hasText ? C.surface : C.surfaceAlt; }}
                          onDrop={e => {
                            e.preventDefault();
                            e.currentTarget.style.background = isCenter ? C.primaryLight : hasText ? C.surface : C.surfaceAlt;
                            const cellSource = e.dataTransfer.getData("application/x-cell");
                            if (cellSource && !isCenter) { swapCells(cellSource, cell.id); setDragCellId(null); }
                            else dropCell(cell.id);
                          }}
                          onClick={() => {
                            if (editing || cellInputId === cell.id || dragCellId) return;
                            if (!isCenter && hasText) drillDown(cell);
                            else if (!isCenter && !hasText && !dragId && !dragCellId) { setCellInputId(cell.id); setCellInputText(""); }
                          }}
                          className="mandal-cell"
                          style={{
                            background: isCenter ? `linear-gradient(135deg, ${C.primaryLight}, #E0E7FF)` : allDone ? C.accentLight : hasText ? C.surface : C.surfaceAlt,
                            border: isCenter ? `2px solid ${C.primary}` : (dragId || dragCellId) ? `2px dashed ${C.primaryBorder}` : `1.5px solid ${C.border}`,
                            borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            padding: 8, cursor: !isCenter && hasText ? "grab" : !isCenter ? "pointer" : "default", position: "relative",
                            opacity: isDraggingThis ? 0.35 : 1,
                            boxShadow: isCenter ? "0 2px 8px rgba(99,102,241,.15)" : hasText ? "0 1px 4px rgba(0,0,0,.04)" : "none",
                            animation: (dragId || dragCellId) && !hasText && !isCenter ? "cellPulse 1.5s ease infinite" : "none",
                          }}>
                          {editing ? (
                            <input value={editCellText} onChange={e => setEditCellText(e.target.value)} onKeyDown={e => e.key === "Enter" && saveCellEdit()} onBlur={saveCellEdit} autoFocus
                              style={{ width: "90%", padding: "4px 6px", borderRadius: 8, border: `2px solid ${C.primary}`, fontSize: 12, textAlign: "center", outline: "none" }} />
                          ) : cellInputId === cell.id ? (
                            <input value={cellInputText} onChange={e => setCellInputText(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") commitCellInput(cell.id); if (e.key === "Escape") setCellInputId(null); }}
                              onBlur={() => commitCellInput(cell.id)} autoFocus placeholder="입력..."
                              style={{ width: "90%", padding: "4px 6px", borderRadius: 8, border: `2px solid ${C.accent}`, fontSize: 12, textAlign: "center", outline: "none" }} />
                          ) : (
                            <>
                              {hasText ? (
                                <div style={{ textAlign: "center", width: "100%" }}>
                                  <div style={{
                                    fontWeight: isCenter ? 800 : 600, fontSize: isCenter ? 13 : 11,
                                    color: allDone ? "#059669" : isCenter ? C.primary : C.text,
                                    lineHeight: 1.3, wordBreak: "break-word",
                                    textDecoration: allDone ? "line-through" : "none",
                                    opacity: allDone ? 0.7 : 1,
                                  }}>{cell.text}</div>
                                  {linked.length > 0 && <div style={{ fontSize: 8, color: allDone ? "#059669" : C.textMuted, marginTop: 3 }}>{allDone ? "✓ 완료" : `${linked.filter(t => t.status === "done" || t.status === "reflect").length}/${linked.length}`}</div>}
                                  {!isCenter && !allDone && <div style={{ fontSize: 8, color: C.primary, fontWeight: 700, marginTop: 2, opacity: 0.6 }}>▸ 상세</div>}
                                </div>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                  <span style={{ color: (dragId || dragCellId) ? C.primary : C.textMuted, fontSize: (dragId || dragCellId) ? 16 : 18, fontWeight: 300, lineHeight: 1 }}>{(dragId || dragCellId) ? "↓" : "+"}</span>
                                  {(dragId || dragCellId) && <span style={{ fontSize: 9, color: C.primary, fontWeight: 600 }}>놓기</span>}
                                </div>
                              )}
                              {hasText && !isCenter && <button onClick={e => { e.stopPropagation(); clearCell(cell.id); }}
                                style={{ position: "absolute", top: 3, left: 4, background: "rgba(255,255,255,.8)", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 9, color: C.textMuted, opacity: 0, lineHeight: 1, padding: "2px", transition: "opacity .15s" }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = "0"; }}
                              >✕</button>}
                              {hasText && <button onClick={e => { e.stopPropagation(); setEditCellId(cell.id); setEditCellText(cell.text); }}
                                style={{ position: "absolute", top: 3, right: 4, background: "rgba(255,255,255,.8)", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 9, color: C.textMuted, opacity: 0, padding: "2px", transition: "opacity .15s" }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = "0"; }}
                              >✎</button>}
                              {hasText && !isCenter && linked.length > 0 && (
                                <button onClick={e => {
                                  e.stopPropagation();
                                  up(d => {
                                    linked.forEach(lt => {
                                      const t = d.tasks.find(x => x.id === lt.id);
                                      if (!t) return;
                                      if (t.status === "done" || t.status === "reflect") {
                                        t.status = "placed"; t.completedAt = null;
                                      } else {
                                        t.status = "done"; t.completedAt = new Date().toISOString();
                                        gainXP(15);
                                      }
                                    });
                                  });
                                }}
                                  style={{
                                    position: "absolute", bottom: 4, right: 5,
                                    width: 22, height: 22, borderRadius: 6,
                                    background: allDone ? "#059669" : C.surface,
                                    border: allDone ? "none" : `2px solid ${C.border}`,
                                    cursor: "pointer", fontSize: 12,
                                    color: allDone ? "#fff" : C.textMuted,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    transition: "all .2s cubic-bezier(.25,.46,.45,.94)",
                                    fontWeight: 700, padding: 0,
                                    boxShadow: allDone ? "0 2px 6px rgba(5,150,105,.3)" : "none",
                                  }}
                                >{allDone ? "✓" : ""}</button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Trash drop zone for 3x3 view */}
                  {dragCellId && (
                    <div
                      className="cloud-trash"
                      onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.borderColor = C.rose; }}
                      onDragLeave={e => { e.currentTarget.style.background = ""; e.currentTarget.style.borderColor = ""; }}
                      onDrop={e => {
                        e.preventDefault();
                        const cellSource = e.dataTransfer.getData("application/x-cell");
                        if (cellSource) { clearCell(cellSource); setDragCellId(null); }
                      }}
                      style={{
                        maxWidth: 400, margin: "12px auto 0", padding: "12px 16px",
                        borderRadius: 12, border: `2px dashed ${C.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        color: C.textMuted, fontSize: 13, fontWeight: 500,
                        transition: "all .2s cubic-bezier(.25,.46,.45,.94)",
                      }}
                    >
                      <span style={{ fontSize: 18 }}>🗑</span> 여기에 놓으면 초기화
                    </div>
                  )}
                  </>
                )}
                </>) : (
                  /* ===== Matrix View ===== */
                  (() => {
                    const allTasks = selFolderId
                      ? data.tasks.filter(t => t.folderId === selFolderId || t.status === "draft")
                      : data.tasks;
                    const zones = [
                      { key: "hi-hi", label: "긴급 + 중요", sub: "즉시 실행", urgency: "high", importance: "high", bg: "#FEE2E2", border: "#FECACA", text: "#991B1B", icon: "🔥" },
                      { key: "lo-hi", label: "중요하지만 여유", sub: "계획 수립", urgency: "low", importance: "high", bg: "#DBEAFE", border: "#BFDBFE", text: "#1E40AF", icon: "📋" },
                      { key: "hi-lo", label: "긴급하지만 덜 중요", sub: "위임 고려", urgency: "high", importance: "low", bg: "#FEF3C7", border: "#FDE68A", text: "#92400E", icon: "⚡" },
                      { key: "lo-lo", label: "여유 + 덜 중요", sub: "나중에 / 제거", urgency: "low", importance: "low", bg: "#F1F5F9", border: "#E2E8F0", text: "#475569", icon: "💤" },
                    ];
                    const getZone = (t: Task) => {
                      const u = t.urgency === "high" ? "high" : "low";
                      const im = t.importance === "high" ? "high" : "low";
                      return `${u === "high" ? "hi" : "lo"}-${im === "high" ? "hi" : "lo"}`;
                    };
                    const unassigned = allTasks.filter(t => !t.urgency && !t.importance);
                    const hashNum = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h); };
                    const cloudColors = ["#6366F1", "#10B981", "#F59E0B", "#F43F5E", "#8B5CF6", "#0EA5E9", "#D946EF", "#F97316"];

                    return (
                      <div style={{ animation: "matrixIn .35s cubic-bezier(.25,.46,.45,.94)" }}>
                        {/* Unassigned cloud */}
                        {unassigned.length > 0 && (
                          <div style={{
                            background: `linear-gradient(145deg, #FAFBFF, ${C.primaryLight}40)`,
                            borderRadius: 16, padding: "14px 14px 10px", marginBottom: 14,
                            border: `1.5px solid ${C.primaryBorder}`,
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ fontSize: 14 }}>☁️</span> 미분류 항목
                              <span style={{ background: C.primary, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{unassigned.length}</span>
                              <span style={{ color: C.textMuted, fontWeight: 400, fontSize: 10 }}>아래 영역으로 드래그</span>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "6px 8px", padding: "4px 0" }}>
                              {unassigned.map((t, idx) => {
                                const h = hashNum(t.id);
                                const color = cloudColors[h % cloudColors.length];
                                return (
                                  <span key={t.id} className="cloud-word" draggable
                                    onDragStart={e => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; setDragId(t.id); }}
                                    onDragEnd={() => setDragId(null)}
                                    onClick={() => { setSelTaskId(t.id); setShowDetail(true); }}
                                    style={{
                                      ["--rot" as any]: "0deg",
                                      fontSize: 14, fontWeight: 600, color, cursor: "grab",
                                      padding: "4px 10px", borderRadius: 8, whiteSpace: "nowrap", userSelect: "none",
                                      opacity: dragId === t.id ? 0.2 : 1,
                                      background: dragId === t.id ? color + "12" : "transparent",
                                      animation: `cloudPop .35s cubic-bezier(.25,.46,.45,.94) ${idx * 0.04}s both`,
                                    }}
                                  >{t.text}</span>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 2x2 Eisenhower Matrix */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxWidth: 600, margin: "0 auto" }}>
                          {/* Axis labels */}
                          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", gap: 4, marginBottom: -4 }}>
                            <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>← 긴급 →</span>
                          </div>
                          {zones.map(z => {
                            const zoneTasks = allTasks.filter(t => getZone(t) === z.key);
                            return (
                              <div key={z.key} className="matrix-zone"
                                onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = z.bg; }}
                                onDragLeave={e => { e.currentTarget.style.background = z.bg + "80"; }}
                                onDrop={e => {
                                  e.preventDefault(); e.currentTarget.style.background = z.bg + "80";
                                  if (!dragId) return;
                                  up(d => {
                                    const t = d.tasks.find(x => x.id === dragId);
                                    if (t) { t.urgency = z.urgency; t.importance = z.importance; }
                                  });
                                  setDragId(null);
                                  showToast(`${z.label}에 배치`);
                                }}
                                style={{
                                  background: z.bg + "80", borderRadius: 14, padding: 14,
                                  border: `1.5px solid ${z.border}`, minHeight: 120,
                                  animation: dragId ? "cellPulse 2s ease infinite" : "none",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
                                  <span style={{ fontSize: 14 }}>{z.icon}</span>
                                  <div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: z.text }}>{z.label}</div>
                                    <div style={{ fontSize: 9, color: z.text, opacity: 0.6 }}>{z.sub}</div>
                                  </div>
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 8px", alignItems: "center" }}>
                                  {zoneTasks.map((t, idx) => {
                                    const h = hashNum(t.id);
                                    const fontSize = Math.max(11, Math.min(18, 13 + (t.priority === "high" ? 4 : t.priority === "medium" ? 2 : 0)));
                                    return (
                                      <span key={t.id} className="cloud-word" draggable
                                        onDragStart={e => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; setDragId(t.id); }}
                                        onDragEnd={() => setDragId(null)}
                                        onClick={() => { setSelTaskId(t.id); setShowDetail(true); }}
                                        style={{
                                          ["--rot" as any]: "0deg",
                                          fontSize, fontWeight: 600, color: z.text, cursor: "grab",
                                          padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap", userSelect: "none",
                                          opacity: dragId === t.id ? 0.2 : (t.status === "done" ? 0.4 : 0.9),
                                          textDecoration: t.status === "done" ? "line-through" : "none",
                                          animation: `cloudPop .3s cubic-bezier(.25,.46,.45,.94) ${idx * 0.03}s both`,
                                        }}
                                      >{t.text}</span>
                                    );
                                  })}
                                  {zoneTasks.length === 0 && (
                                    <span style={{ fontSize: 11, color: z.text, opacity: 0.3, fontStyle: "italic" }}>
                                      {dragId ? "여기에 놓기" : "항목 없음"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ textAlign: "center", fontSize: 10, color: C.textMuted, marginTop: 6, opacity: 0.5 }}>
                          ↑ 중요 · ↓ 덜 중요
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* Folder memo + links + deadlines */}
                {selFolderId && (() => {
                  const folder = data.folders.find(f => f.id === selFolderId);
                  if (!folder) return null;
                  const links = data.folderLinks.filter(l => l.fromFolderId === selFolderId || l.toFolderId === selFolderId);
                  const deadlineTasks = data.tasks.filter(t => t.folderId === selFolderId && t.deadline)
                    .sort((a, b) => (a.deadline || "").localeCompare(b.deadline || ""));
                  return (
                    <div style={{ marginTop: 12 }}>
                      {deadlineTasks.length > 0 && (
                        <div style={{ background: C.warmLight, borderRadius: 10, padding: "8px 12px", marginBottom: 8, border: `1px solid ${C.warmBorder}` }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#92400E", marginBottom: 4 }}>마감 임박</div>
                          {deadlineTasks.slice(0, 5).map(t => {
                            const days = Math.ceil((new Date(t.deadline!).getTime() - Date.now()) / 86400000);
                            const color = days < 0 ? C.rose : days <= 3 ? "#F59E0B" : "#065F46";
                            return (
                              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, marginBottom: 2 }}>
                                <span style={{ fontWeight: 700, color, minWidth: 36 }}>{days < 0 ? `${-days}일↑` : days === 0 ? "오늘!" : `D-${days}`}</span>
                                <span style={{ color: C.text }}>{t.text}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {links.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                          <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>연결:</span>
                          {links.map(l => {
                            const otherId = l.fromFolderId === selFolderId ? l.toFolderId : l.fromFolderId;
                            const other = data.folders.find(f => f.id === otherId);
                            return other ? (
                              <button key={l.id} onClick={() => openFolder(other)}
                                style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: C.primaryLight, color: C.primary, border: `1px solid ${C.primaryBorder}`, cursor: "pointer", fontWeight: 600 }}>
                                {other.title} →
                              </button>
                            ) : null;
                          })}
                        </div>
                      )}
                      {data.folders.filter(f => f.id !== selFolderId && !links.some(l => (l.fromFolderId === f.id && l.toFolderId === selFolderId) || (l.toFolderId === f.id && l.fromFolderId === selFolderId))).length > 0 && (
                        <select onChange={e => {
                          if (!e.target.value) return;
                          up(d => { d.folderLinks.push({ id: uid(), fromFolderId: selFolderId!, toFolderId: e.target.value, label: "" }); });
                          e.target.value = "";
                        }} style={{ fontSize: 10, padding: "3px 6px", borderRadius: 5, border: `1px solid ${C.border}`, color: C.textMuted, marginBottom: 8 }}>
                          <option value="">+ 폴더 연결...</option>
                          {data.folders.filter(f => f.id !== selFolderId && !links.some(l => (l.fromFolderId === f.id && l.toFolderId === selFolderId) || (l.toFolderId === f.id && l.fromFolderId === selFolderId))).map(f => (
                            <option key={f.id} value={f.id}>{f.title}</option>
                          ))}
                        </select>
                      )}
                      <textarea value={folder.memo} onChange={e => up(d => { const f = d.folders.find(x => x.id === selFolderId); if (f) f.memo = e.target.value; })}
                        placeholder="여백 메모 — 프레임워크, 방법론, 핵심 정리..."
                        rows={3} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 12, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.6 }} />

                      {/* AI Insight Panel */}
                      <div style={{ marginTop: 12, background: `linear-gradient(135deg, ${C.violetLight}, ${C.primaryLight}60)`, borderRadius: 14, border: `1.5px solid ${C.violetBorder}`, overflow: "hidden" }}>
                        <button onClick={async () => {
                          setAiLoading(true);
                          try {
                            const folderTasks = data.tasks.filter(t => t.folderId === selFolderId);
                            const doneCount = folderTasks.filter(t => t.status === "done" || t.status === "reflect").length;
                            const draftCount = folderTasks.filter(t => t.status === "draft").length;
                            const placedCount = folderTasks.filter(t => t.status === "placed").length;
                            const highPri = folderTasks.filter(t => t.priority === "high").length;
                            const cells = data.cells.filter(c => c.boardId === folder.rootBoardId);
                            const filledCells = cells.filter(c => c.position !== 4 && c.text).length;
                            const allFolders = data.folders.map(f => f.title).join(", ");
                            const completionRate = folderTasks.length ? Math.round(doneCount / folderTasks.length * 100) : 0;

                            const prompt = `사용자의 만다라트 현황을 분석해주세요.

${profileContext ? `사용자 프로필:\n${profileContext}\n` : ""}
현재 폴더: "${folder.title}"
전체 주제: ${allFolders}
이 폴더 항목: ${folderTasks.length}개 (완료 ${doneCount}, 진행중 ${placedCount}, 미배치 ${draftCount})
완료율: ${completionRate}%
높은 우선순위: ${highPri}개
만다라트 셀 채움: ${filledCells}/8
메모: ${folder.memo || "(없음)"}

항목 목록:
${folderTasks.map(t => `- ${t.text} [${t.status}]${t.priority ? ` 우선순위:${t.priority}` : ""}${t.urgency ? ` 긴급:${t.urgency}` : ""}${t.deadline ? ` 마감:${t.deadline}` : ""}`).join("\n")}

아래 형식으로 분석해주세요. 순수 JSON만:
{
  "patterns": "이 사용자의 업무 패턴 한 줄 요약",
  "bottleneck": "고질적 문제나 병목 지점 (없으면 null)",
  "suggestions": ["새로 추가하면 좋을 항목 3개 (워드클라우드 추천)"],
  "insight": "이 주제에 대한 전략적 조언 2-3문장",
  "emptySlots": "비어있는 만다라트 셀에 넣으면 좋을 키워드 제안 (쉼표 구분)"
}`;

                            const result = await callAI(
                              "당신은 만다라트 시간관리 및 생산성 코치입니다. 사용자의 데이터를 분석하여 실질적이고 구체적인 인사이트를 제공합니다. 한국어로 응답하세요. 순수 JSON만 응답.",
                              prompt
                            );
                            const json = JSON.parse(result.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
                            up(d => {
                              const f = d.folders.find(x => x.id === selFolderId);
                              if (f) (f as any)._insight = json;
                            });
                            showToast("AI 분석 완료");
                          } catch (e: any) {
                            showToast("AI: " + e.message);
                          }
                          setAiLoading(false);
                        }}
                          disabled={aiLoading}
                          style={{
                            width: "100%", padding: "12px 16px", background: "transparent", border: "none",
                            cursor: aiLoading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 8,
                            textAlign: "left",
                          }}>
                          <span style={{ fontSize: 18 }}>{aiLoading ? "⏳" : "🧠"}</span>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#6D28D9" }}>
                              {aiLoading ? "분석 중..." : "AI 인사이트"}
                            </div>
                            <div style={{ fontSize: 10, color: "#7C3AED", opacity: 0.7 }}>
                              패턴 분석 · 추천 · 병목 진단
                            </div>
                          </div>
                          {!(folder as any)._insight && !aiLoading && (
                            <span style={{ marginLeft: "auto", fontSize: 11, color: C.violet, fontWeight: 600 }}>분석하기 →</span>
                          )}
                        </button>

                        {(folder as any)._insight && (() => {
                          const ins = (folder as any)._insight as { patterns: string; bottleneck: string | null; suggestions: string[]; insight: string; emptySlots: string };
                          return (
                            <div style={{ padding: "0 16px 14px", animation: "appleIn .35s cubic-bezier(.25,.46,.45,.94)" }}>
                              {/* Pattern */}
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                                <span style={{ fontSize: 13, flexShrink: 0 }}>📊</span>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "#6D28D9", marginBottom: 2 }}>업무 패턴</div>
                                  <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>{ins.patterns}</div>
                                </div>
                              </div>

                              {/* Bottleneck */}
                              {ins.bottleneck && (
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10, background: "#FEF2F2", borderRadius: 10, padding: "8px 10px" }}>
                                  <span style={{ fontSize: 13, flexShrink: 0 }}>⚠️</span>
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#991B1B", marginBottom: 2 }}>병목 포인트</div>
                                    <div style={{ fontSize: 12, color: "#7F1D1D", lineHeight: 1.5 }}>{ins.bottleneck}</div>
                                  </div>
                                </div>
                              )}

                              {/* Strategic insight */}
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                                <span style={{ fontSize: 13, flexShrink: 0 }}>💡</span>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "#6D28D9", marginBottom: 2 }}>전략 조언</div>
                                  <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>{ins.insight}</div>
                                </div>
                              </div>

                              {/* Suggested new items - clickable to add as drafts */}
                              {ins.suggestions?.length > 0 && (
                                <div style={{ marginBottom: 10 }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: "#6D28D9", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ fontSize: 13 }}>✨</span> 추천 항목 (클릭하여 추가)
                                  </div>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                    {ins.suggestions.map((s: string, i: number) => (
                                      <button key={i} onClick={() => {
                                        up(d => {
                                          if (d.tasks.find(t => t.text === s)) { showToast("이미 있는 항목"); return; }
                                          d.tasks.push({
                                            id: uid(), text: s, status: "draft", memo: "", folderId: null, boardId: null,
                                            cellPosition: null, completedAt: null, toReflect: false, _today: false,
                                            priority: null, urgency: null, importance: null, category: folder.title,
                                            timeSlot: null, clusterId: null, deadline: null,
                                          });
                                        });
                                        showToast(`"${s}" 추가됨`);
                                      }}
                                        style={{
                                          padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                                          background: "#EDE9FE", color: "#6D28D9", border: `1px solid ${C.violetBorder}`,
                                          cursor: "pointer", transition: "all .2s cubic-bezier(.25,.46,.45,.94)",
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = "#DDD6FE"; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = "#EDE9FE"; }}
                                      >+ {s}</button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Empty slot suggestions */}
                              {ins.emptySlots && (
                                <div style={{ fontSize: 10, color: "#7C3AED", opacity: 0.8 }}>
                                  <span style={{ fontWeight: 700 }}>빈 셀 추천:</span> {ins.emptySlots}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ===== COACH - AI Coaching Chat ===== */}
        {tab === "coach" && (
          <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", height: "calc(100vh - 120px)" }}>
            {/* Header with today's summary */}
            <div style={{ marginBottom: 12, animation: "appleIn .4s cubic-bezier(.25,.46,.45,.94)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 18 }}>🧠</span> AI 코칭
                </h2>
                <button onClick={() => setCoachMessages([])} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, cursor: "pointer", color: C.textMuted, fontWeight: 500 }}>새 대화</button>
              </div>

              {/* Today's quick stats */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, background: C.accentLight, borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.accentBorder}` }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#065F46", marginBottom: 2 }}>오늘 진행</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#059669" }}>{todayDone}/{todayList.length}</div>
                </div>
                <div style={{ flex: 1, background: C.warmLight, borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.warmBorder}` }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#92400E", marginBottom: 2 }}>임시함</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.warm }}>{drafts.length}</div>
                </div>
                <div style={{ flex: 1, background: C.primaryLight, borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.primaryBorder}` }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: "#4338CA", marginBottom: 2 }}>연속</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.primary }}>{xpData.streak}일</div>
                </div>
              </div>

              {/* Today's tasks checklist */}
              {todayList.length > 0 && (
                <div style={{ background: C.surface, borderRadius: 10, padding: "8px 10px", border: `1px solid ${C.border}`, marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.textSub, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>오늘의 할 일</span>
                    <span style={{ color: todayDone === todayList.length ? "#059669" : C.textMuted }}>{todayList.length ? Math.round(todayDone / todayList.length * 100) : 0}%</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {todayList.slice(0, 5).map(t => {
                      const isDone = t.status === "done" || t.status === "reflect";
                      return (
                        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                          <button onClick={() => isDone ? null : markDone(t.id)} style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${isDone ? C.accent : C.border}`, background: isDone ? C.accentLight : "transparent", cursor: isDone ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#059669", padding: 0 }}>
                            {isDone && "✓"}
                          </button>
                          <span style={{ color: isDone ? C.textMuted : C.text, textDecoration: isDone ? "line-through" : "none", flex: 1 }}>{t.text}</span>
                          <PriorityBadge level={t.priority} />
                        </div>
                      );
                    })}
                    {todayList.length > 5 && <div style={{ fontSize: 10, color: C.textMuted, textAlign: "center" }}>+{todayList.length - 5}개 더</div>}
                  </div>
                </div>
              )}
            </div>

            {/* Quick start buttons (show only when no messages) */}
            {coachMessages.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, animation: "fadeSlideUp .5s cubic-bezier(.25,.46,.45,.94)" }}>
                <p style={{ fontSize: 13, color: C.textSub, textAlign: "center", marginBottom: 4 }}>무엇을 도와드릴까요?</p>
                {[
                  { type: "morning" as const, icon: "☀️", label: "오늘 하루 계획 세우기", color: C.warmLight, borderColor: C.warmBorder, textColor: "#92400E" },
                  { type: "evening" as const, icon: "🌙", label: "하루 회고하기", color: C.violetLight, borderColor: C.violetBorder, textColor: "#6D28D9" },
                  { type: "plan" as const, icon: "📊", label: "주간 점검 & 분석", color: C.primaryLight, borderColor: C.primaryBorder, textColor: "#4338CA" },
                ].map(b => (
                  <button key={b.type} onClick={() => startCoachSession(b.type)} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: 12,
                    background: b.color, border: `1px solid ${b.borderColor}`, cursor: "pointer",
                    transition: "all .2s cubic-bezier(.25,.46,.45,.94)",
                  }}>
                    <span style={{ fontSize: 20 }}>{b.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: b.textColor }}>{b.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Chat messages */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingBottom: 8 }}>
              {coachMessages.map((msg, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  animation: "fadeSlideUp .3s cubic-bezier(.25,.46,.45,.94)",
                }}>
                  <div style={{
                    maxWidth: "85%", padding: "10px 14px", borderRadius: 16,
                    ...(msg.role === "user" ? {
                      background: C.primary, color: "#fff",
                      borderBottomRightRadius: 4,
                    } : {
                      background: C.surface, color: C.text,
                      border: `1px solid ${C.border}`,
                      borderBottomLeftRadius: 4,
                    }),
                    fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word",
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {coachLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start", animation: "fadeSlideUp .3s" }}>
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, borderBottomLeftRadius: 4, padding: "12px 18px", display: "flex", gap: 4, alignItems: "center" }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: 6, height: 6, borderRadius: "50%", background: C.textMuted,
                        animation: `cellPulse 1.2s ease-in-out ${i * 0.15}s infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              )}

              <div ref={coachEndRef} />
            </div>

            {/* Input area */}
            <div style={{ padding: "8px 0", borderTop: `1px solid ${C.border}`, background: C.bg }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <textarea
                  value={coachInput}
                  onChange={e => setCoachInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendCoachMessage(); } }}
                  placeholder="코치에게 물어보세요..."
                  rows={1}
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 12, border: `1.5px solid ${C.border}`,
                    fontSize: 14, fontFamily: "inherit", resize: "none", boxSizing: "border-box",
                    background: C.surface, transition: "border-color .2s",
                    maxHeight: 100, overflow: "auto",
                  }}
                  onFocus={e => { e.target.style.borderColor = C.primary; }}
                  onBlur={e => { e.target.style.borderColor = C.border; }}
                />
                <button
                  onClick={sendCoachMessage}
                  disabled={!coachInput.trim() || coachLoading}
                  style={{
                    width: 40, height: 40, borderRadius: 12, border: "none",
                    background: coachInput.trim() && !coachLoading ? C.primary : C.surfaceAlt,
                    color: coachInput.trim() && !coachLoading ? "#fff" : C.textMuted,
                    cursor: coachInput.trim() && !coachLoading ? "pointer" : "default",
                    fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all .2s cubic-bezier(.25,.46,.45,.94)",
                    flexShrink: 0,
                  }}
                >↑</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* TAB BAR */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40, background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", padding: "5px 0 env(safe-area-inset-bottom, 6px)", boxShadow: "0 -2px 10px rgba(0,0,0,.04)" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1, background: "none", border: "none", cursor: "pointer", padding: "5px 2px", color: tab === t.key ? C.primary : C.textMuted, fontWeight: tab === t.key ? 700 : 400, fontSize: 10, position: "relative" }}>
            <span style={{ fontSize: 17 }}>{t.icon}</span><span>{t.label}</span>
            {t.badge && <span style={{ position: "absolute", top: 1, right: "50%", transform: "translateX(14px)", background: C.primary, color: "#fff", borderRadius: 8, padding: "0 4px", fontSize: 8, fontWeight: 700 }}>{t.badge}</span>}
          </button>
        ))}
      </nav>

      {/* DETAIL MODAL */}
      {showDetail && selTask && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.35)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowDetail(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: "20px 20px 0 0", padding: "20px 18px 28px", width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto", boxShadow: "0 -4px 30px rgba(0,0,0,.12)" }}>
            <div style={{ width: 36, height: 4, background: C.border, borderRadius: 2, margin: "0 auto 14px" }} />
            <input value={selTask.text} onChange={e => up(d => { const t = d.tasks.find(x => x.id === selTask.id); if (t) t.text = e.target.value; })}
              style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 15, fontWeight: 600, marginBottom: 10, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
              <span style={{ ...(() => { const s = statusStyle[selTask.status]; return { background: s.bg, color: s.text, border: `1px solid ${s.border}` }; })(), borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{statusStyle[selTask.status]?.label}</span>
              {selTask.category && (() => { const cc = getCategoryColor(selTask.category); return <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: cc.bg, color: cc.text, fontWeight: 600, border: `1px solid ${cc.border}` }}>{selTask.category}</span>; })()}
              {selTask.folderId && <span style={{ fontSize: 11, color: C.textSub }}>📁 {data.folders.find(f => f.id === selTask.folderId)?.title}</span>}
              {selTask.clusterId && <span style={{ fontSize: 11, color: C.violet }}>🔗 {data.clusters.find(cl => cl.id === selTask.clusterId)?.label}</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 12 }}>
              {(["priority", "urgency", "importance"] as const).map(field => (
                <div key={field}>
                  <label style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 3 }}>{{ priority: "우선순위", urgency: "시급성", importance: "중요도" }[field]}</label>
                  <div style={{ display: "flex", gap: 3 }}>
                    {(["high", "medium", "low"] as const).map(level => (
                      <button key={level} onClick={() => up(d => { const t = d.tasks.find(x => x.id === selTask.id); if (t) (t as any)[field] = (t as any)[field] === level ? null : level; })}
                        style={{ flex: 1, padding: "4px 0", borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: "pointer", background: (selTask as any)[field] === level ? priorityMeta[level].color + "20" : C.surfaceAlt, color: (selTask as any)[field] === level ? priorityMeta[level].color : C.textMuted, border: `1px solid ${(selTask as any)[field] === level ? priorityMeta[level].color + "60" : C.borderLight}` }}>{priorityMeta[level].emoji}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Time slot quick assign */}
            {selTask._today && !selTask.timeSlot && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>시간 배정</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {[6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map(h => (
                    <button key={h} onClick={() => { assignTimeSlot(selTask.id, h); setShowDetail(false); }}
                      style={{ padding: "3px 6px", borderRadius: 4, fontSize: 10, cursor: "pointer", background: C.surfaceAlt, border: `1px solid ${C.borderLight}`, color: C.textSub, fontWeight: 500 }}>{formatHour(h)}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Deadline */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, whiteSpace: "nowrap" }}>마감일</label>
              <input type="date" value={selTask.deadline || ""} onChange={e => up(d => { const t = d.tasks.find(x => x.id === selTask.id); if (t) t.deadline = e.target.value || null; })}
                style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: `1.5px solid ${C.border}`, fontSize: 12 }} />
              {selTask.deadline && (() => {
                const days = Math.ceil((new Date(selTask.deadline).getTime() - Date.now()) / 86400000);
                const color = days < 0 ? C.rose : days <= 3 ? "#F59E0B" : "#065F46";
                return <span style={{ fontSize: 11, fontWeight: 700, color }}>{days < 0 ? `${-days}일 지남` : days === 0 ? "오늘!" : `D-${days}`}</span>;
              })()}
            </div>
            <textarea value={selTask.memo} onChange={e => up(d => { const t = d.tasks.find(x => x.id === selTask.id); if (t) t.memo = e.target.value; })} placeholder="메모" rows={2}
              style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 12, marginBottom: 12, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {selTask.status !== "done" && selTask.status !== "reflect" && <Btn variant="accent" onClick={() => { markDone(selTask.id); setShowDetail(false); }} style={{ width: "100%" }}>✓ 완료</Btn>}
              {!selTask._today && <Btn variant="warm" onClick={() => { moveToday(selTask.id); showToast("오늘 업무에 추가됨"); }} style={{ width: "100%" }}>☀️ 오늘 업무로</Btn>}
              {selTask.status === "done" && <Btn variant="violet" onClick={() => sendReflect(selTask.id)} style={{ width: "100%" }}>✎ 회고로</Btn>}
              {selTask.timeSlot && <Btn variant="ghost" onClick={() => removeTimeSlot(selTask.id)} style={{ width: "100%" }}>⏰ 시간 배정 해제</Btn>}
              <Btn variant="primary" onClick={() => promoteToTheme(selTask.id)} style={{ width: "100%" }}>◈ 주제로 승격</Btn>
              <Btn variant="danger" onClick={() => delTask(selTask.id)} style={{ width: "100%" }}>삭제</Btn>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS */}
      {showSettings && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.35)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowSettings(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: 16, padding: 24, width: "100%", maxWidth: 400, boxShadow: "0 8px 30px rgba(0,0,0,.15)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>⚙ 설정</h3>

            {/* XP Summary */}
            <div style={{ background: C.primaryLight, borderRadius: 10, padding: 12, marginBottom: 16, border: `1px solid ${C.primaryBorder}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 24 }}>{getGrowthIcon(level)}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.primary }}>Level {level}</div>
                  <div style={{ fontSize: 11, color: C.textSub }}>{xpData.xp} XP · {xpData.streak}일 연속</div>
                </div>
              </div>
              <div style={{ background: "#fff", height: 8, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${xpProgress}%`, background: `linear-gradient(90deg, ${C.primary}, ${C.violet})`, borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 9, color: C.textMuted, marginTop: 4, textAlign: "right" }}>{xpData.xp} / {nextLevelXP} XP</div>
            </div>

            {/* Profile summary */}
            {profile?.completed && (
              <div style={{ background: C.surfaceAlt, borderRadius: 10, padding: 12, marginBottom: 16, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>내 프로필</div>
                <div style={{ fontSize: 11, color: C.textSub, lineHeight: 1.6 }}>
                  <div>💼 {profile.occupation}</div>
                  <div>🎯 {profile.goals.join(", ")}</div>
                  <div>⏰ {profile.lifePattern}</div>
                  <div>💡 {profile.values}</div>
                  <div>🤔 {profile.concerns}</div>
                </div>
                <textarea
                  value={profile.bio || ""}
                  onChange={e => {
                    const newProfile = { ...profile, bio: e.target.value };
                    setProfile(newProfile);
                    saveProfile(newProfile);
                  }}
                  placeholder="AI에게 알려주고 싶은 추가 정보를 자유롭게 적어주세요.&#10;예: 현재 하는 일, 팀 구성, 진행 중인 프로젝트, 선호하는 작업 방식, 장단기 목표 등"
                  rows={4}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 12, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", marginTop: 8, lineHeight: 1.6 }}
                />
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button onClick={() => { setShowSettings(false); setOnboardStep(0); setOnboardAnswers([]); setOnboardInput(""); setAiOnboardQ(null); setShowOnboarding(true); }}
                    style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", color: C.textSub }}>프로필 다시 설정</button>
                </div>
              </div>
            )}

            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSub, display: "block", marginBottom: 6 }}>Anthropic API 키</label>
            <input value={aiKeyInput} onChange={e => setAiKeyInput(e.target.value)} placeholder="sk-ant-..." type="password"
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, boxSizing: "border-box", marginBottom: 6 }} />
            <p style={{ fontSize: 10, color: C.textMuted, marginBottom: 14 }}>AI 기능에 사용. 브라우저에만 저장됩니다.</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <Btn variant="primary" onClick={() => { setAiKey(aiKeyInput); setShowSettings(false); showToast("저장됨"); }}>저장</Btn>
              <Btn variant="ghost" onClick={() => setShowSettings(false)}>닫기</Btn>
            </div>
            <hr style={{ border: "none", borderTop: `1px solid ${C.border}`, marginBottom: 12 }} />
            {data.folders.length === 0 && (
              <Btn variant="primary" onClick={() => { loadAnalogData(); setShowSettings(false); }} style={{ width: "100%", fontSize: 12, marginBottom: 8 }}>📋 아날로그 만다라트 불러오기</Btn>
            )}
            <Btn variant="danger" onClick={() => { if (confirm("모든 데이터를 초기화?")) { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(PATTERN_KEY); localStorage.removeItem(XP_KEY); localStorage.removeItem(PROFILE_KEY); setData({ tasks: [], folders: [], boards: [], cells: [], reflections: [], clusters: [], connections: [], dailyMoods: [], folderLinks: [] }); setXpData({ xp: 0, streak: 0, lastDate: "" }); setProfile(null); setShowSettings(false); } }} style={{ width: "100%", fontSize: 12 }}>데이터 초기화</Btn>
          </div>
        </div>
      )}

      {/* CSS animation */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
      `}</style>
    </div>
  );
}
