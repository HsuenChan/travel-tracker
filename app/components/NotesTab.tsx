"use client";

import { useState, useEffect } from "react";
import { Typography, Skeleton, message } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { SparkleIcon, EditIcon } from "@/app/components/Icons";
import PillButton from "./PillButton";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import QuillEditor from "@/app/components/QuillEditor";

interface SectionDef {
  key: string;
  title: string;
}

const SECTION_DEFS: SectionDef[] = [
  { key: "travel_tips", title: "旅遊注意事項" },
  { key: "packing_list", title: "該帶什麼" },
  { key: "driving", title: "自駕資訊" },
  { key: "metro", title: "地鐵攻略" },
  { key: "bus", title: "公車/巴士" },
  { key: "transit", title: "轉車換乘" },
];

/** Convert AI plain-text output (bullets / 【categories】/ **bold**) into Quill-compatible HTML */
function applyInlineMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function textToHtml(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let html = "";
  let inList = false;

  for (const line of lines) {
    const isBullet = line.startsWith("• ") || line.startsWith("•");
    if (isBullet) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${applyInlineMarkdown(line.replace(/^•\s*/, ""))}</li>`;
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      if (line.startsWith("【") && line.endsWith("】")) {
        html += `<p><strong>${line}</strong></p>`;
      } else {
        html += `<p>${applyInlineMarkdown(line)}</p>`;
      }
    }
  }
  if (inList) html += "</ul>";
  return html;
}

/**
 * Quill 的 semantic HTML 會把每一個空格都換成 &nbsp;，閱讀模式的英文長句因此
 * 永遠不會斷行。單獨出現的還原成普通空格，連續兩個以上（使用者刻意排版）保留。
 */
function normalizeSpaces(html: string): string {
  return html.replace(/(?:&nbsp;)+/g, (run) => (run.length === 6 ? " " : run));
}

/** Append HTML to existing note content, stripping trailing Quill empty para */
function appendToContent(prev: string, html: string): string {
  const cleaned = prev.replace(/(<p><br><\/p>)+\s*$/, "").trim();
  return cleaned + html + "<p><br></p>";
}

interface Props {
  tripId: string;
  readOnly?: boolean;
  initialContent?: string;
}

export default function NotesTab({ tripId, readOnly, initialContent }: Props) {
  const [noteContent, setNoteContent] = useState<string>(initialContent || "");
  const [lastSaved, setLastSaved] = useState<string>(initialContent || "");
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();

  const draftKey = `travel_notes_draft_${tripId}`;
  const dirty = !readOnly && noteContent !== lastSaved;

  useEffect(() => {
    async function fetchNotes() {
      const cacheKey = `travel_notes_${tripId}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setNoteContent(cached);
        setLastSaved(cached);
        setLoading(false);
      }

      let serverContent = "";
      const res = await fetchWithAuth(`/api/trips/${tripId}/notes`);
      if (res.ok) {
        const data = await res.json();
        const saved = data.notes as { content?: string } | null;
        if (saved?.content) {
          serverContent = saved.content;
          localStorage.setItem(cacheKey, saved.content);
        }
      }

      const draft = readOnly ? null : localStorage.getItem(draftKey);
      if (draft && draft !== serverContent) {
        setNoteContent(draft);
        setLastSaved(serverContent);
        setEditing(true);
        messageApi.info("已還原上次未儲存的草稿");
      } else if (serverContent) {
        setNoteContent(serverContent);
        setLastSaved(serverContent);
      }
      setLoading(false);
    }
    if (initialContent) {
      setNoteContent(initialContent);
      setLastSaved(initialContent);
      setLoading(false);
    } else if (readOnly) {
      // 分享頁沒有筆記時不打需要登入的 API（fetchWithAuth 401 會把訪客踢去登入頁）
      setLoading(false);
    } else {
      fetchNotes();
    }
  }, [tripId, initialContent]);

  // Persist unsaved edits so switching tabs (which unmounts this component) never loses them
  useEffect(() => {
    if (loading || readOnly) return;
    if (noteContent === lastSaved) {
      localStorage.removeItem(draftKey);
    } else {
      localStorage.setItem(draftKey, noteContent);
    }
  }, [noteContent, lastSaved, loading, readOnly, draftKey]);

  /** Insert section heading only (no AI content) */
  function handleInsertHeading(key: string) {
    const def = SECTION_DEFS.find((s) => s.key === key)!;
    const html = `<h2>${def.title}</h2>`;
    setNoteContent((prev) => appendToContent(prev, html));
  }

  /** Generate AI content for section, then append heading + content */
  async function handleGenerate(key: string) {
    const def = SECTION_DEFS.find((s) => s.key === key)!;
    setGenerating((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetchWithAuth(`/api/trips/${tripId}/notes/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: key }),
      });
      if (res.ok) {
        const data = await res.json();
        const bodyHtml = textToHtml(data.content);
        const headingHtml = `<h2>${def.title}</h2>`;
        setNoteContent((prev) => appendToContent(prev, headingHtml + bodyHtml));
      } else {
        messageApi.error("生成失敗，請重試");
      }
    } finally {
      setGenerating((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function handleSave() {
    setSaving(true);
    const content = normalizeSpaces(noteContent);
    try {
      const res = await fetchWithAuth(`/api/trips/${tripId}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: { content } }),
      });
      if (res.ok) {
        messageApi.success("已儲存");
        localStorage.setItem(`travel_notes_${tripId}`, content);
        setNoteContent(content);
        setLastSaved(content);
        setEditing(false);
      } else {
        messageApi.error("儲存失敗，請重試");
      }
    } catch {
      messageApi.error("儲存失敗，請檢查網路連線");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 mt-3">
        <div className="flex gap-2 flex-wrap">
          {SECTION_DEFS.map((_, i) => (
            <div key={i} className="flex items-stretch h-7 animate-pulse">
              <div className="w-24 rounded-l-full bg-white/[0.06]" />
              <div className="w-7 rounded-r-full bg-white/[0.05] ml-[1px]" />
            </div>
          ))}
        </div>
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-[18px] p-4">
          <Skeleton active paragraph={{ rows: 6 }} title={false} />
        </div>
      </div>
    );
  }

  return (
    <>
      {contextHolder}
      <div className="mt-3 flex flex-col gap-4">

        {(!editing || readOnly) ? (
          <>
            {!readOnly && (
              <div className="flex items-center justify-between">
                <Typography.Text strong className="text-zinc-100 text-[15px]">旅遊筆記</Typography.Text>
                <PillButton onClick={() => setEditing(true)}>
                  <EditIcon size={13} />
                  編輯
                  {dirty && <span className="w-1.5 h-1.5 rounded-full bg-violet-400" aria-label="有未儲存變更" />}
                </PillButton>
              </div>
            )}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-[18px] p-4 min-h-[140px]">
              {noteContent && noteContent.replace(/<p><br><\/p>/g, "").trim() !== "" ? (
                <div
                  className="notes-content text-zinc-200 text-[14px] leading-[1.75]"
                  dangerouslySetInnerHTML={{ __html: noteContent }}
                />
              ) : (
                <div className="text-zinc-400 text-sm">
                  {readOnly ? "尚無筆記" : "還沒有筆記 — 點右上「編輯」開始，或用 AI 生成各區塊內容。"}
                </div>
              )}
            </div>
          </>
        ) : (
        <>
        {/* Section chips — split button: left = insert heading, right ✦ = AI generate */}
        {!readOnly && (
          <div>
            <Typography.Text className="text-zinc-400 text-[11px] block mb-3 mt-1">
              點左側新增標題，點右側星形按鈕讓 AI 生成內容
            </Typography.Text>
            <div className="flex flex-wrap gap-2">
              {SECTION_DEFS.map(({ key, title }) => (
                <div key={key} className="flex items-stretch">
                  <button
                    onClick={() => handleInsertHeading(key)}
                    className="inline-flex items-center gap-1.5 rounded-l-full text-[12px] font-medium h-7 pl-3 pr-2.5 bg-white/[0.04] border border-r-0 border-white/[0.09] text-zinc-400 hover:border-white/20 hover:text-zinc-200 hover:bg-white/[0.07] transition-all cursor-pointer"
                  >
                    {title}
                  </button>
                  <button
                    onClick={() => handleGenerate(key)}
                    disabled={!!generating[key]}
                    title={`AI 生成「${title}」`}
                    aria-label={`AI 生成「${title}」`}
                    className="inline-flex items-center justify-center rounded-r-full text-[11px] font-medium h-7 w-7 bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/25 hover:text-violet-300 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {generating[key]
                      ? <LoadingOutlined style={{ fontSize: 10 }} />
                      : <SparkleIcon size={11} />
                    }
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unified rich-text editor */}
        <div className={`bg-white/[0.03] border border-white/[0.07] rounded-[18px] overflow-hidden ${readOnly ? "read-only-notes" : ""}`}>
          <QuillEditor
            value={noteContent}
            onChange={setNoteContent}
            placeholder={readOnly ? "" : "在這裡記下旅遊筆記，或點上方星形按鈕讓 AI 幫你生成各區塊內容..."}
            extraClass="notes-quill"
            readOnly={readOnly || saving || Object.values(generating).some(Boolean)}
          />
        </div>

        {!readOnly && (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full text-[14px] font-semibold h-10 bg-white/[0.06] border border-white/10 text-zinc-200 hover:bg-white/10 hover:text-white transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              {saving && <LoadingOutlined style={{ fontSize: 13 }} />}
              儲存筆記
              {dirty && !saving && <span className="w-1.5 h-1.5 rounded-full bg-violet-400" aria-label="有未儲存變更" />}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="inline-flex items-center justify-center rounded-full text-[14px] font-medium h-10 px-5 text-zinc-400 hover:text-zinc-200 border border-white/10 hover:bg-white/[0.06] transition-all duration-200 cursor-pointer"
            >
              閱讀模式
            </button>
          </div>
        )}
        </>
        )}
      </div>
    </>
  );
}
