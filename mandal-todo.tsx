import { useState, useEffect, useRef } from "react";

let _id = Date.now();
const uid = () => String(++_id);

// ===== Color System =====
const C = {
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F5F9",
  border: "#E2E8F0",
  borderLight: "#F1F5F9",
  text: "#1E293B",
  textSub: "#64748B",
  textMuted: "#94A3B8",
  primary: "#6366F1",
  primaryLight: "#EEF2FF",
  primaryBorder: "#C7D2FE",
  accent: "#10B981",
  accentLight: "#ECFDF5",
  accentBorder: "#A7F3D0",
  warm: "#F59E0B",
  warmLight: "#FFFBEB",
  warmBorder: "#FDE68A",
  rose: "#F43F5E",
  violet: "#8B5CF6",
  violetLight: "#F5F3FF",
  violetBorder: "#DDD6FE",
};

const statusStyle = {
  draft: { bg: C.warmLight, border: C.warmBorder, text: "#92400E", label: "임시" },
  placed: { bg: C.primaryLight, border: C.primaryBorder, text: "#4338CA", label: "배치됨" },
  done: { bg: C.accentLight, border: C.accentBorder, text: "#065F46", label: "완료" },
  reflect: { bg: C.violetLight, border: C.violetBorder, text: "#6D28D9", label: "회고" },
};

const folderColors = ["#EEF2FF", "#ECFDF5", "#FFFBEB", "#FFF1F2", "#F0F9FF", "#FDF4FF"];

// ===== Sample Data =====
const createSampleData = () => {
  const f1 = uid(), f2 = uid(), f3 = uid();
  const b1 = uid(), b2 = uid(), b3 = uid();
  const folders = [
    { id: f1, title: "수업", color: folderColors[0], rootBoardId: b1 },
    { id: f2, title: "RISE 프로젝트", color: folderColors[1], rootBoardId: b2 },
    { id: f3, title: "학회 활동", color: folderColors[2], rootBoardId: b3 },
  ];
  const boards = [
    { id: b1, folderId: f1, parentCellId: null, title: "수업" },
    { id: b2, folderId: f2, parentCellId: null, title: "RISE 프로젝트" },
    { id: b3, folderId: f3, parentCellId: null, title: "학회 활동" },
  ];
  const makeCells = (boardId) => Array.from({ length: 9 }, (_, i) => ({
    id: uid(), boardId, position: i, text: "", linkedTaskIds: [], childBoardId: null,
  }));
  const cells = [...makeCells(b1), ...makeCells(b2), ...makeCells(b3)];
  const sampleTexts = [
    "수업 준비", "영상커뮤니케이션 자료 정리", "창의콘텐츠제작세미나 피드백",
    "1인 미디어 콘텐츠 점검", "RISE 예산 정리", "전문가 섭외",
    "장비 견적 확인", "학회 홈페이지 더미 제작", "총회 영상 편집",
  ];
  const tasks = sampleTexts.map(text => ({
    id: uid(), text, status: "draft", memo: "", folderId: null,
    boardId: null, cellPosition: null, completedAt: null, toReflect: false, _today: false,
  }));
  return { tasks, folders, boards, cells, reflections: [] };
};

// ===== Components =====
const Chip = ({ task, onClick, onDragStart, onDragEnd, dragging }) => {
  const s = statusStyle[task.status] || statusStyle.draft;
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData("text/plain", task.id); onDragStart?.(task.id); }}
      onDragEnd={onDragEnd}
      onClick={() => onClick?.(task.id)}
      style={{
        background: s.bg, border: `1.5px solid ${s.border}`, color: s.text,
        borderRadius: 8, padding: "6px 12px", cursor: "grab", fontSize: 13, fontWeight: 500,
        display: "inline-flex", alignItems: "center", gap: 6, userSelect: "none",
        transition: "transform .1s, box-shadow .1s",
        transform: dragging ? "scale(1.04)" : "none",
        boxShadow: dragging ? "0 4px 12px rgba(0,0,0,.12)" : "0 1px 2px rgba(0,0,0,.04)",
        maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{task.text}</span>
      <span style={{ fontSize: 10, opacity: .55, flexShrink: 0 }}>{s.label}</span>
    </div>
  );
};

const SectionHeader = ({ icon, title, sub, right }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 18 }}>{icon}</span> {title}
      </h2>
      {sub && <p style={{ fontSize: 12, color: C.textMuted, margin: "4px 0 0" }}>{sub}</p>}
    </div>
    {right}
  </div>
);

const Btn = ({ children, variant = "default", ...props }) => {
  const styles = {
    primary: { background: C.primary, color: "#fff", border: "none" },
    accent: { background: C.accent, color: "#fff", border: "none" },
    warm: { background: C.warm, color: "#fff", border: "none" },
    violet: { background: C.violet, color: "#fff", border: "none" },
    danger: { background: "#fff", color: C.rose, border: `1.5px solid ${C.rose}` },
    default: { background: "#fff", color: C.text, border: `1.5px solid ${C.border}` },
    ghost: { background: "transparent", color: C.textSub, border: "none" },
  };
  const s = styles[variant] || styles.default;
  return (
    <button {...props} style={{
      ...s, padding: "8px 16px", borderRadius: 8, cursor: "pointer",
      fontWeight: 600, fontSize: 13, transition: "opacity .1s", ...props.style
    }}>{children}</button>
  );
};

// ===== Main =====
export default function MandalTodo() {
  const [data, setData] = useState(createSampleData);
  const [tab, setTab] = useState("staging");
  const [selFolderId, setSelFolderId] = useState(null);
  const [boardPath, setBoardPath] = useState([]);
  const [selTaskId, setSelTaskId] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [newFolder, setNewFolder] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [refDate, setRefDate] = useState(new Date().toISOString().slice(0, 10));
  const [refText, setRefText] = useState("");
  const [editCellId, setEditCellId] = useState(null);
  const [editCellText, setEditCellText] = useState("");
  const [inputVal, setInputVal] = useState("");

  useEffect(() => {
    (async () => { try { const r = await window.storage.get("mandal-v2"); if (r?.value) setData(JSON.parse(r.value)); } catch {} })();
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => { try { await window.storage.set("mandal-v2", JSON.stringify(data)); } catch {} }, 400);
    return () => clearTimeout(t);
  }, [data]);

  const up = (fn) => setData(p => { const n = JSON.parse(JSON.stringify(p)); fn(n); return n; });

  const drafts = data.tasks.filter(t => t.status === "draft");
  const todayList = data.tasks.filter(t => t._today);
  const todayDone = todayList.filter(t => t.status === "done" || t.status === "reflect").length;
  const curBoardId = boardPath[boardPath.length - 1] || null;
  const curCells = data.cells.filter(c => c.boardId === curBoardId).sort((a, b) => a.position - b.position);
  const selTask = data.tasks.find(t => t.id === selTaskId);
  const curRef = data.reflections.find(r => r.date === refDate);

  const submitInput = () => {
    const items = inputVal.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    if (!items.length) return;
    up(d => items.forEach(text => d.tasks.push({
      id: uid(), text, status: "draft", memo: "", folderId: null, boardId: null, cellPosition: null, completedAt: null, toReflect: false, _today: false
    })));
    setInputVal("");
  };

  const createFolderAction = () => {
    if (!newFolder.trim()) return;
    const bId = uid();
    up(d => {
      const fId = uid();
      d.folders.push({ id: fId, title: newFolder.trim(), color: folderColors[d.folders.length % folderColors.length], rootBoardId: bId });
      d.boards.push({ id: bId, folderId: fId, parentCellId: null, title: newFolder.trim() });
      for (let i = 0; i < 9; i++) d.cells.push({ id: uid(), boardId: bId, position: i, text: "", linkedTaskIds: [], childBoardId: null });
    });
    setNewFolder(""); setShowNewFolder(false);
  };

  const openFolder = (f) => { setSelFolderId(f.id); setBoardPath([f.rootBoardId]); setTab("mandal"); };

  const dropFolder = (fId) => { if (!dragId) return; up(d => { const t = d.tasks.find(x => x.id === dragId); if (t) t.folderId = fId; }); setDragId(null); };

  const dropCell = (cId) => {
    if (!dragId) return;
    up(d => {
      const t = d.tasks.find(x => x.id === dragId);
      const c = d.cells.find(x => x.id === cId);
      if (t && c) {
        t.status = "placed"; t.boardId = c.boardId; t.cellPosition = c.position;
        t.folderId = d.boards.find(b => b.id === c.boardId)?.folderId || t.folderId;
        if (!c.linkedTaskIds.includes(t.id)) c.linkedTaskIds.push(t.id);
        if (!c.text) c.text = t.text;
      }
    });
    setDragId(null);
  };

  const drillDown = (cell) => {
    if (cell.position === 4) return;
    let childId = cell.childBoardId;
    if (!childId) {
      childId = uid();
      up(d => {
        const c = d.cells.find(x => x.id === cell.id);
        c.childBoardId = childId;
        d.boards.push({ id: childId, folderId: selFolderId, parentCellId: cell.id, title: cell.text || "하위 만다라트" });
        for (let i = 0; i < 9; i++) d.cells.push({ id: uid(), boardId: childId, position: i, text: i === 4 ? (cell.text || "") : "", linkedTaskIds: [], childBoardId: null });
      });
    }
    setBoardPath(p => [...p, childId]);
  };

  const goBack = () => { if (boardPath.length > 1) setBoardPath(p => p.slice(0, -1)); else { setBoardPath([]); setTab("folders"); } };

  const markDone = id => up(d => { const t = d.tasks.find(x => x.id === id); if (t) { t.status = "done"; t.completedAt = new Date().toISOString(); } });
  const moveToday = id => up(d => { const t = d.tasks.find(x => x.id === id); if (t) t._today = true; });
  const sendReflect = id => up(d => { const t = d.tasks.find(x => x.id === id); if (t) { t.toReflect = true; t.status = "reflect"; } });
  const delTask = id => { up(d => { d.tasks = d.tasks.filter(x => x.id !== id); d.cells.forEach(c => { c.linkedTaskIds = c.linkedTaskIds.filter(x => x !== id); }); }); setSelTaskId(null); setShowDetail(false); };

  const saveRef = () => {
    if (!refText.trim()) return;
    up(d => {
      const rt = d.tasks.filter(t => t.toReflect).map(t => t.id);
      const ex = d.reflections.find(r => r.date === refDate);
      if (ex) { ex.text = refText; ex.linkedTaskIds = [...new Set([...ex.linkedTaskIds, ...rt])]; }
      else d.reflections.push({ id: uid(), date: refDate, linkedTaskIds: rt, text: refText });
    });
  };

  const saveCellEdit = () => { if (editCellId) { up(d => { const c = d.cells.find(x => x.id === editCellId); if (c) c.text = editCellText; }); setEditCellId(null); } };

  const breadcrumb = () => {
    const cr = [];
    const f = data.folders.find(x => x.id === selFolderId);
    if (f) cr.push({ label: f.title, idx: 0 });
    for (let i = 1; i < boardPath.length; i++) {
      const b = data.boards.find(x => x.id === boardPath[i]);
      cr.push({ label: b?.title || "하위", idx: i });
    }
    return cr;
  };

  const tabs = [
    { key: "staging", label: "임시함", icon: "📥", badge: drafts.length || null },
    { key: "folders", label: "폴더", icon: "📁" },
    { key: "mandal", label: "만다라트", icon: "◈" },
    { key: "today", label: "오늘", icon: "☀️", badge: todayList.length ? `${todayDone}/${todayList.length}` : null },
    { key: "reflection", label: "회고", icon: "✎" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, 'Pretendard', sans-serif", color: C.text, display: "flex", flexDirection: "column" }}>

      {/* ===== TOP INPUT ===== */}
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 16px", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", gap: 8 }}>
          <input
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitInput(); } }}
            placeholder="해야 할 일이나 떠오르는 생각을 쉼표(,)로 구분해 적어보세요"
            style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, outline: "none", background: C.surfaceAlt, transition: "border .15s" }}
            onFocus={e => e.target.style.borderColor = C.primary}
            onBlur={e => e.target.style.borderColor = C.border}
          />
          <Btn variant="primary" onClick={submitInput} style={{ borderRadius: 10, padding: "10px 18px" }}>추가</Btn>
        </div>
        <p style={{ maxWidth: 680, margin: "6px auto 0", fontSize: 11, color: C.textMuted }}>
          생각나는 대로 적어도 괜찮아요. 구조는 나중에 정해드릴게요.
        </p>
      </header>

      {/* ===== CONTENT ===== */}
      <main style={{ flex: 1, maxWidth: 680, width: "100%", margin: "0 auto", padding: "20px 16px 100px" }}>

        {/* STAGING */}
        {tab === "staging" && (
          <div>
            <SectionHeader icon="📥" title="임시함" sub="블록을 드래그하여 폴더나 만다라트 셀에 배치하세요" />
            {drafts.length === 0 ? (
              <div style={{ background: C.surface, borderRadius: 14, padding: "48px 20px", textAlign: "center", border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>🫧</p>
                <p style={{ color: C.textMuted, fontSize: 14 }}>아직 블록이 없습니다</p>
                <p style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>위 입력창에서 할 일을 입력해보세요</p>
              </div>
            ) : (
              <div style={{ background: C.surface, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {drafts.map(t => <Chip key={t.id} task={t} onClick={id => { setSelTaskId(id); setShowDetail(true); }} onDragStart={setDragId} onDragEnd={() => setDragId(null)} dragging={dragId === t.id} />)}
              </div>
            )}
          </div>
        )}

        {/* FOLDERS */}
        {tab === "folders" && (
          <div>
            <SectionHeader icon="📁" title="폴더" sub="폴더를 선택하면 만다라트가 열립니다"
              right={<Btn onClick={() => setShowNewFolder(true)}>+ 새 폴더</Btn>}
            />
            {showNewFolder && (
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input value={newFolder} onChange={e => setNewFolder(e.target.value)} onKeyDown={e => e.key === "Enter" && createFolderAction()}
                  placeholder="폴더 이름" autoFocus
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 14 }} />
                <Btn variant="primary" onClick={createFolderAction}>생성</Btn>
                <Btn variant="ghost" onClick={() => setShowNewFolder(false)}>취소</Btn>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
              {data.folders.map(f => {
                const cnt = data.tasks.filter(t => t.folderId === f.id).length;
                return (
                  <div key={f.id} onClick={() => openFolder(f)}
                    onDragOver={e => e.preventDefault()} onDrop={() => dropFolder(f.id)}
                    style={{
                      background: f.color, borderRadius: 14, padding: "20px 16px", cursor: "pointer",
                      border: dragId ? `2px dashed ${C.primary}` : `1.5px solid transparent`,
                      transition: "all .15s", boxShadow: "0 1px 3px rgba(0,0,0,.04)"
                    }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{f.title}</div>
                    <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>{cnt}개 항목</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MANDAL-ART */}
        {tab === "mandal" && (
          <div>
            {!curBoardId ? (
              <div style={{ background: C.surface, borderRadius: 14, padding: "48px 20px", textAlign: "center", border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>◈</p>
                <p style={{ color: C.textMuted, fontSize: 14 }}>폴더를 선택하면 만다라트가 열립니다</p>
                <Btn variant="primary" onClick={() => setTab("folders")} style={{ marginTop: 12 }}>폴더 보기</Btn>
              </div>
            ) : (
              <div>
                {/* Breadcrumb */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                  <Btn variant="ghost" onClick={goBack} style={{ padding: "4px 10px", fontSize: 13 }}>← 이전</Btn>
                  {breadcrumb().map((cr, i) => (
                    <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {i > 0 && <span style={{ color: C.textMuted, fontSize: 12 }}>/</span>}
                      <button onClick={() => setBoardPath(p => p.slice(0, cr.idx + 1))}
                        style={{ background: "none", border: "none", cursor: "pointer", fontWeight: i === breadcrumb().length - 1 ? 700 : 500, color: i === breadcrumb().length - 1 ? C.text : C.textSub, fontSize: 14 }}>
                        {cr.label}
                      </button>
                    </span>
                  ))}
                </div>

                {/* 3×3 Grid */}
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6,
                  maxWidth: 420, margin: "0 auto", aspectRatio: "1/1",
                }}>
                  {curCells.map(cell => {
                    const isCenter = cell.position === 4;
                    const linked = cell.linkedTaskIds.map(id => data.tasks.find(t => t.id === id)).filter(Boolean);
                    const editing = editCellId === cell.id;
                    const hasContent = !!cell.text;

                    return (
                      <div key={cell.id}
                        onDragOver={e => e.preventDefault()} onDrop={() => dropCell(cell.id)}
                        onClick={() => { if (!isCenter && hasContent && !editing) drillDown(cell); }}
                        style={{
                          background: isCenter ? C.primaryLight : hasContent ? C.surface : C.surfaceAlt,
                          border: isCenter ? `2px solid ${C.primary}` : dragId ? `2px dashed ${C.primaryBorder}` : `1.5px solid ${C.border}`,
                          borderRadius: 12, display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center", padding: 8,
                          cursor: !isCenter && hasContent ? "pointer" : "default",
                          transition: "all .12s", position: "relative",
                          boxShadow: isCenter ? "0 2px 8px rgba(99,102,241,.12)" : "none",
                        }}>
                        {editing ? (
                          <input value={editCellText} onChange={e => setEditCellText(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && saveCellEdit()} onBlur={saveCellEdit} autoFocus
                            style={{ width: "90%", padding: "4px 6px", borderRadius: 6, border: `1.5px solid ${C.primary}`, fontSize: 12, textAlign: "center" }} />
                        ) : (
                          <>
                            {hasContent ? (
                              <div style={{ textAlign: "center", width: "100%" }}>
                                <div style={{ fontWeight: isCenter ? 700 : 600, fontSize: isCenter ? 13 : 12, color: C.text, lineHeight: 1.35, wordBreak: "break-word" }}>
                                  {cell.text}
                                </div>
                                {linked.length > 0 && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>{linked.length}개 연결</div>}
                                {!isCenter && <div style={{ fontSize: 10, color: C.primary, marginTop: 2, fontWeight: 600 }}>▸ 하위</div>}
                              </div>
                            ) : (
                              <span style={{ color: C.textMuted, fontSize: 12 }}>+ 추가</span>
                            )}
                            <button onClick={e => { e.stopPropagation(); setEditCellId(cell.id); setEditCellText(cell.text); }}
                              style={{ position: "absolute", top: 3, right: 5, background: "none", border: "none", cursor: "pointer", fontSize: 10, color: C.textMuted, padding: 2, opacity: .5 }}>✎</button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p style={{ textAlign: "center", fontSize: 11, color: C.textMuted, marginTop: 14 }}>
                  AI는 제안만 합니다. 결정은 당신이 합니다.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TODAY */}
        {tab === "today" && (
          <div>
            <SectionHeader icon="☀️" title="오늘의 업무" sub="오늘의 만다라가 당신의 하루를 기록합니다" />
            {todayList.length === 0 ? (
              <div style={{ background: C.surface, borderRadius: 14, padding: "48px 20px", textAlign: "center", border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>☀️</p>
                <p style={{ color: C.textMuted, fontSize: 14 }}>아직 오늘의 업무가 없습니다</p>
                <p style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>블록 상세에서 "오늘의 업무로 이동"을 눌러보세요</p>
              </div>
            ) : (
              <>
                <div style={{ background: C.accentLight, borderRadius: 10, padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#065F46" }}>{todayDone} / {todayList.length} 완료</span>
                  <div style={{ background: C.accent, height: 6, borderRadius: 3, flex: 1, marginLeft: 14, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${todayList.length ? (todayDone / todayList.length * 100) : 0}%`, background: "#059669", borderRadius: 3, transition: "width .3s" }} />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {todayList.map(t => {
                    const isDone = t.status === "done" || t.status === "reflect";
                    return (
                      <div key={t.id} style={{
                        background: C.surface, borderRadius: 10, padding: "12px 14px",
                        border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10,
                      }}>
                        <button onClick={() => !isDone && markDone(t.id)}
                          style={{
                            width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                            border: `2px solid ${isDone ? C.accent : C.border}`,
                            background: isDone ? C.accent : "transparent",
                            cursor: isDone ? "default" : "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "#fff", fontSize: 12,
                          }}>{isDone ? "✓" : ""}</button>
                        <span style={{
                          flex: 1, fontSize: 14, color: isDone ? C.textMuted : C.text,
                          textDecoration: isDone ? "line-through" : "none",
                        }}>{t.text}</span>
                        <button onClick={() => { setSelTaskId(t.id); setShowDetail(true); }}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: C.textMuted }}>⋯</button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* REFLECTION */}
        {tab === "reflection" && (
          <div>
            <SectionHeader icon="✎" title="회고" sub="완료한 일은 회고로 보낼 수 있습니다" />
            <input type="date" value={refDate} onChange={e => setRefDate(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 14, marginBottom: 14 }} />

            {(() => {
              const rt = data.tasks.filter(t => t.toReflect);
              if (!rt.length) return null;
              return (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.textSub, marginBottom: 6 }}>회고로 보낸 항목</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {rt.map(t => <Chip key={t.id} task={t} onClick={id => { setSelTaskId(id); setShowDetail(true); }} onDragStart={() => {}} onDragEnd={() => {}} />)}
                  </div>
                </div>
              );
            })()}

            <textarea
              value={curRef?.text ?? refText}
              onChange={e => {
                const v = e.target.value;
                setRefText(v);
                if (curRef) up(d => { const r = d.reflections.find(x => x.id === curRef.id); if (r) r.text = v; });
              }}
              placeholder="오늘의 일에서 느낀 점, 배운 점을 기록해보세요."
              rows={5}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
            <Btn variant="violet" onClick={saveRef} style={{ marginTop: 10 }}>저장하기</Btn>

            {data.reflections.filter(r => r.id !== curRef?.id).length > 0 && (
              <div style={{ marginTop: 24 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.textSub, marginBottom: 8 }}>지난 회고</p>
                {data.reflections.filter(r => r.id !== curRef?.id).map(r => (
                  <div key={r.id} style={{ background: C.violetLight, borderRadius: 10, padding: "12px 16px", marginBottom: 8, border: `1px solid ${C.violetBorder}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.violet }}>{r.date}</div>
                    <div style={{ fontSize: 14, color: C.text, marginTop: 4, whiteSpace: "pre-wrap" }}>{r.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ===== BOTTOM TAB BAR ===== */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
        background: C.surface, borderTop: `1px solid ${C.border}`,
        display: "flex", justifyContent: "space-around", padding: "6px 0 env(safe-area-inset-bottom, 8px)",
        boxShadow: "0 -2px 10px rgba(0,0,0,.04)",
      }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              background: "none", border: "none", cursor: "pointer", padding: "6px 4px",
              color: tab === t.key ? C.primary : C.textMuted, fontWeight: tab === t.key ? 700 : 400,
              transition: "color .12s", fontSize: 10, position: "relative",
            }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span>{t.label}</span>
            {t.badge && (
              <span style={{
                position: "absolute", top: 2, right: "50%", transform: "translateX(14px)",
                background: C.primary, color: "#fff", borderRadius: 8, padding: "1px 5px", fontSize: 9, fontWeight: 700,
              }}>{t.badge}</span>
            )}
          </button>
        ))}
      </nav>

      {/* ===== DETAIL MODAL ===== */}
      {showDetail && selTask && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.35)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0 }}
          onClick={() => setShowDetail(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{
              background: C.surface, borderRadius: "20px 20px 0 0", padding: "24px 20px 32px",
              width: "100%", maxWidth: 480, maxHeight: "75vh", overflowY: "auto",
              boxShadow: "0 -4px 30px rgba(0,0,0,.12)",
            }}>
            {/* Handle */}
            <div style={{ width: 36, height: 4, background: C.border, borderRadius: 2, margin: "0 auto 16px" }} />

            <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: .5 }}>제목</label>
            <input value={selTask.text} onChange={e => up(d => { const t = d.tasks.find(x => x.id === selTask.id); if (t) t.text = e.target.value; })}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 14, marginBottom: 14, marginTop: 4, boxSizing: "border-box" }} />

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>상태</label>
              <span style={{ ...(() => { const s = statusStyle[selTask.status]; return { background: s.bg, color: s.text, border: `1px solid ${s.border}` }; })(), borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
                {statusStyle[selTask.status]?.label}
              </span>
              {selTask.folderId && <span style={{ fontSize: 12, color: C.textSub }}>📁 {data.folders.find(f => f.id === selTask.folderId)?.title}</span>}
            </div>

            <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted }}>메모</label>
            <textarea value={selTask.memo} onChange={e => up(d => { const t = d.tasks.find(x => x.id === selTask.id); if (t) t.memo = e.target.value; })}
              placeholder="메모나 의견을 남겨보세요." rows={3}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, marginBottom: 16, marginTop: 4, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {selTask.status !== "done" && selTask.status !== "reflect" && (
                <Btn variant="accent" onClick={() => markDone(selTask.id)} style={{ width: "100%" }}>✓ 완료로 표시</Btn>
              )}
              {!selTask._today && <Btn variant="warm" onClick={() => moveToday(selTask.id)} style={{ width: "100%" }}>☀️ 오늘의 업무로 이동</Btn>}
              {selTask.status === "done" && <Btn variant="violet" onClick={() => sendReflect(selTask.id)} style={{ width: "100%" }}>✎ 회고로 보내기</Btn>}
              <Btn variant="danger" onClick={() => delTask(selTask.id)} style={{ width: "100%" }}>삭제</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
