import { useState, useRef, useCallback } from "react";
import JSZip from "jszip";
import "./App.css";

const PREDEFINED_ROLES = [
  "老板兼课程顾问", "课程顾问", "客户群体", "签证员",
  "我", "我的家人", "我的亲戚", "我的朋友", "陌生人"
];

const TYPES = [
  {
    key: "VOICE", icon: "ti-microphone", label: "语音", color: "#5F5E5A",
    hint: "如有音频文件，稍后放入 assets/voices/ 文件夹",
    fields: [
      { k: "content", label: "转写内容", type: "textarea", ph: "把微信语音转文字结果粘贴到这里，或手动听写…", rows: 4 },
      { k: "filename", label: "语音文件名（可选）", type: "text", ph: "voice_001.m4a" },
      { k: "duration", label: "时长（秒）", type: "text", ph: "例：32" },
    ],
    build: (f) => {
      const content = f.content?.trim() || "（未听写）";
      const fn = f.filename?.trim() ? `[语音文件](assets/voices/${f.filename.trim()}) ` : "";
      const dur = f.duration?.trim() ? `（${f.duration.trim()}秒）` : "";
      return `${fn}[语音→文字${dur}]\n${content}`;
    },
  },
  {
    key: "IMAGE", icon: "ti-photo", label: "图片", color: "#1D9E75",
    hint: "稍后请将图片文件放入 assets/images/ 文件夹",
    fields: [
      { k: "desc", label: "图片内容描述", type: "textarea", ph: "描述图片内容...", rows: 3 },
      { k: "filename", label: "文件名（可选）", type: "text", ph: "img_20250514_001.jpg" },
    ],
    build: (f, n) => {
      const fn = f.filename?.trim() || `img_DATE_${String(n).padStart(3,"0")}.jpg`;
      const desc = f.desc?.trim() || "图片";
      return `![${desc}](assets/images/${fn})`;
    },
  },
  {
    key: "ARTICLE", icon: "ti-article", label: "公众号", color: "#BA7517",
    hint: "长按文章卡片 → 复制链接",
    fields: [
      { k: "title", label: "文章标题", type: "text", ph: "例：2025菲律宾游学完整攻略" },
      { k: "url", label: "链接", type: "text", ph: "https://mp.weixin.qq.com/s/xxx" },
      { k: "summary", label: "要点摘要", type: "textarea", ph: "把文章里对客户有用的关键信息摘出来...", rows: 4 },
    ],
    build: (f) => {
      const title = f.title?.trim() || "（未填标题）";
      const url = f.url?.trim() ? `\n链接：${f.url.trim()}` : "";
      const summary = f.summary?.trim() ? `\n要点：${f.summary.trim()}` : "";
      return `[公众号] ${title}${url}${summary}`;
    },
  },
  {
    key: "VIDEO", icon: "ti-brand-youtube", label: "视频", color: "#378ADD",
    hint: "若是本地视频，稍后请放入 assets/videos/ 文件夹",
    fields: [
      { k: "title", label: "视频标题", type: "text", ph: "例：菲律宾英语游学实拍" },
      { k: "filename", label: "本地文件名（若是本地视频）", type: "text", ph: "vid_001.mp4" },
      { k: "url", label: "链接（有的话）", type: "text", ph: "https://..." },
      { k: "desc", label: "内容描述", type: "textarea", ph: "视频里展示了什么...", rows: 3 },
    ],
    build: (f) => {
      const title = f.title?.trim() || "（未填标题）";
      const url = f.url?.trim() ? `\n链接：${f.url.trim()}` : "";
      const fn = f.filename?.trim() ? `\n文件：[${f.filename.trim()}](assets/videos/${f.filename.trim()})` : "";
      const desc = f.desc?.trim() ? `\n描述：${f.desc.trim()}` : "";
      return `[视频] ${title}${url}${fn}${desc}`;
    },
  },
  {
    key: "MINI", icon: "ti-apps", label: "小程序", color: "#993556",
    hint: "如有截图，稍后请放入 assets/images/ 文件夹",
    fields: [
      { k: "name", label: "小程序名称", type: "text", ph: "例：XX游学助手" },
      { k: "func", label: "功能描述", type: "text", ph: "例：查询课程报价" },
      { k: "data", label: "截图关键数据", type: "textarea", ph: "把小程序里显示的重要文字抄下来...", rows: 3 },
      { k: "screenshot", label: "截图文件名（可选）", type: "text", ph: "mp_20250514_001.jpg" },
    ],
    build: (f, n) => {
      const name = f.name?.trim() || "（未填名称）";
      const func_ = f.func?.trim() ? ` · ${f.func.trim()}` : "";
      const data = f.data?.trim() ? `\n关键数据：${f.data.trim()}` : "";
      let sc = "";
      if (f.screenshot?.trim() || !f.data?.trim()) {
         const fn = f.screenshot?.trim() || `mp_DATE_${String(n).padStart(3,"0")}.jpg`;
         sc = `\n![小程序截图](assets/images/${fn})`;
      }
      return `[小程序] ${name}${func_}${data}${sc}`;
    },
  },
  {
    key: "FILE", icon: "ti-file", label: "文件", color: "#534AB7",
    hint: "稍后请将文件放入 assets/files/ 文件夹",
    fields: [
      { k: "name", label: "文件名", type: "text", ph: "例：碧瑶2025报价表.pdf" },
      { k: "summary", label: "内容摘要", type: "textarea", ph: "文件里的关键信息...", rows: 3 },
    ],
    build: (f) => {
      const name = f.name?.trim() || "（未填文件名）";
      const summary = f.summary?.trim() ? `\n摘要：${f.summary.trim()}` : "";
      return `[文件] [${name}](assets/files/${name})${summary}`;
    },
  },
];

function parseWeChat(raw) {
  if (!raw.trim()) return [];
  const lines = raw.split(/\r?\n/);
  const messages = [];
  let current = null;
  const nameTimePattern = /^(.+?)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*$/;
  const timeOnlyPattern = /^(\d{4}-\d{2}-\d{2}\s+)?(\d{1,2}:\d{2}(?::\d{2})?)$/;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      if (current) { messages.push(current); current = null; }
      continue;
    }
    const m1 = trimmed.match(nameTimePattern);
    if (m1) {
      if (current) messages.push(current);
      current = { sender: m1[1].trim(), time: m1[2], content: [] };
      continue;
    }
    const m2 = trimmed.match(timeOnlyPattern);
    if (m2 && i + 1 < lines.length) {
      if (current) messages.push(current);
      current = { sender: lines[i + 1]?.trim() || "?", time: m2[2], content: [] };
      i++;
      continue;
    }
    if (current) current.content.push(trimmed);
    else current = { sender: "未知", time: "", content: [trimmed] };
  }
  if (current) messages.push(current);
  return messages.filter(m => m.content.length > 0 || m.sender !== "未知");
}

function buildMarkdown(meta, rawText, selectedRoles) {
  const msgs = parseWeChat(rawText);
  const date = meta.date || new Date().toISOString().split("T")[0];
  const tags = meta.tags ? meta.tags.split(/[，,、\s]+/).map(s => s.trim()).filter(Boolean) : [];
  
  const yaml = [
    "---", 
    `date: ${date}`, 
    `chat_type: ${meta.chatType}`,
    meta.chatType === "single" ? `chat_target: ${meta.targetName || "未命名对象"}` : `group_name: ${meta.targetName || "未命名群组"}`,
    `topic: ${meta.topic || ""}`,
    selectedRoles.length > 0 ? `roles: [${selectedRoles.join(", ")}]` : null,
    tags.length ? `tags: [${tags.join(", ")}]` : null,
    `completeness: 100%`, 
    "---"
  ].filter(Boolean).join("\n");
  
  const body = msgs.length === 0 ? rawText.trim()
    : msgs.map(m => (m.time ? `**${m.sender}** \`${m.time}\`` : `**${m.sender}**`) + "\n" + m.content.join("\n")).join("\n\n");
  return `${yaml}\n\n## 对话记录\n\n${body}\n\n---\n## 分析摘要（待填写）\n- 核心意图：\n- 关键信息：\n- 后续动作：`;
}

export default function App() {
  const [raw, setRaw] = useState("");
  const [meta, setMeta] = useState({ chatType: "single", targetName: "", date: new Date().toISOString().split("T")[0], topic: "", tags: "" });
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [output, setOutput] = useState("");
  const [counts, setCounts] = useState({});
  const [activeType, setActiveType] = useState(null);
  const [formData, setFormData] = useState({});
  const cursorRef = useRef(0);
  const outputRef = useRef(null);

  const updateMeta = (k, v) => setMeta(m => ({ ...m, [k]: v }));
  
  const toggleRole = (role) => {
    setSelectedRoles(prev => 
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const generate = () => setOutput(buildMarkdown(meta, raw, selectedRoles));

  const openForm = (type) => {
    if (outputRef.current) cursorRef.current = outputRef.current.selectionStart || output.length;
    setActiveType(type);
    setFormData({});
  };
  const closeForm = () => { setActiveType(null); setFormData({}); };

  const doInsert = () => {
    const n = (counts[activeType.key] || 0) + 1;
    setCounts(c => ({ ...c, [activeType.key]: n }));
    const block = "\n\n" + activeType.build(formData, n) + "\n\n";
    const pos = cursorRef.current;
    setOutput(o => o.slice(0, pos) + block + o.slice(pos));
    cursorRef.current = pos + block.length;
    closeForm();
    setTimeout(() => {
      if (outputRef.current) {
        outputRef.current.selectionStart = outputRef.current.selectionEnd = cursorRef.current;
        outputRef.current.focus();
      }
    }, 30);
  };

  const stats = output ? (() => ({
    msgs: (output.match(/^\*\*/gm) || []).length,
    media: (output.match(/^\[(?:语音|图片|公众号|视频|小程序|文件)|^\!\[/gm) || []).length,
    chars: output.length,
  }))() : null;

  const preview = activeType && Object.values(formData).some(v => v?.trim())
    ? activeType.build(formData, (counts[activeType.key] || 0) + 1)
    : null;

  const downloadZip = async () => {
    if (!output) return;
    const zip = new JSZip();
    
    // Generate folder name based on chat type and date
    const dateStr = meta.date || "未命名日期";
    const typeStr = meta.chatType === "single" ? "单聊" : "群聊";
    const targetStr = meta.targetName || "未命名";
    const topicStr = meta.topic ? `-${meta.topic}` : "";
    const folderName = `${dateStr}-${typeStr}-${targetStr}${topicStr}`;
    
    // Create main folder
    const mainFolder = zip.folder(folderName);
    
    // Create index.md
    mainFolder.file("index.md", output);
    
    // Create assets structure with .keep files to ensure empty folders exist
    mainFolder.folder("assets").folder("images").file(".keep", "");
    mainFolder.folder("assets").folder("voices").file(".keep", "");
    mainFolder.folder("assets").folder("files").file(".keep", "");
    mainFolder.folder("assets").folder("videos").file(".keep", "");
    
    // Generate and download
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${folderName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="vc-page-container">
      <div className="vc-header-band">
        <h1>微信聊天记录格式化工具</h1>
        <p>粘贴文字 → 生成 Markdown → 补充媒体内容 → 打包下载归档文件夹 (.zip)</p>
      </div>

      <div className="app-grid">
        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="vc-card">
            <div className="vc-card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "1px", margin: 0, color: "var(--vc-mute)" }}>元数据</h2>
              <div style={{ display: "flex", background: "var(--vc-canvas-soft)", padding: 2, borderRadius: "var(--radius-sm)", border: "1px solid var(--vc-hairline)" }}>
                <button 
                  onClick={() => updateMeta("chatType", "single")}
                  style={{ padding: "4px 12px", fontSize: 13, border: "none", background: meta.chatType === "single" ? "var(--vc-canvas)" : "transparent", cursor: "pointer", fontWeight: 500, borderRadius: "var(--radius-xs)", boxShadow: meta.chatType === "single" ? "0 1px 2px rgba(0,0,0,0.05)" : "none", color: meta.chatType === "single" ? "var(--vc-ink)" : "var(--vc-mute)" }}>
                  单聊
                </button>
                <button 
                  onClick={() => updateMeta("chatType", "group")}
                  style={{ padding: "4px 12px", fontSize: 13, border: "none", background: meta.chatType === "group" ? "var(--vc-canvas)" : "transparent", cursor: "pointer", fontWeight: 500, borderRadius: "var(--radius-xs)", boxShadow: meta.chatType === "group" ? "0 1px 2px rgba(0,0,0,0.05)" : "none", color: meta.chatType === "group" ? "var(--vc-ink)" : "var(--vc-mute)" }}>
                  群聊
                </button>
              </div>
            </div>
            
            <div className="form-row">
              <input type="text" className="vc-input" placeholder={meta.chatType === "single" ? "聊天对象 (例: 张三)" : "群名称 (例: VIP咨询群)"} 
                value={meta.targetName} onChange={e => updateMeta("targetName", e.target.value)} 
                style={{ gridColumn: "1/-1" }} />
              <input type="text" className="vc-input" placeholder="日期 2025-05-14" value={meta.date} onChange={e => updateMeta("date", e.target.value)} />
              <input type="text" className="vc-input" placeholder="主题" value={meta.topic} onChange={e => updateMeta("topic", e.target.value)} />
              <input type="text" className="vc-input" placeholder="标签（逗号分隔）" value={meta.tags} onChange={e => updateMeta("tags", e.target.value)} style={{ gridColumn: "1/-1" }} />
            </div>

            <div>
              <span className="vc-label" style={{ fontSize: 12, color: "var(--vc-mute)" }}>参与者身份分类 (可多选)</span>
              <div className="vc-tag-group">
                {PREDEFINED_ROLES.map(role => (
                  <label key={role} className="vc-tag-label">
                    <input type="checkbox" checked={selectedRoles.includes(role)} onChange={() => toggleRole(role)} />
                    <span className="vc-tag">{role}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="vc-card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div className="vc-card-header">
              <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "1px", margin: 0, color: "var(--vc-mute)" }}>原始聊天记录</h2>
            </div>
            <textarea className="vc-textarea" value={raw} onChange={e => setRaw(e.target.value)}
              placeholder={"从微信PC版复制粘贴聊天记录\n\n支持格式：\n顾问小王 10:02\n这个学校环境很好\n\n学员张同学 10:05\n有没有纯会话的课？"}
              style={{ flex: 1, minHeight: 200, fontFamily: "var(--font-mono)", resize: "vertical", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 12 }}>
              <button className="vc-btn vc-btn-primary" onClick={generate} style={{ flex: 1 }}>
                <i className="ti ti-sparkles" aria-hidden="true" />生成 Markdown
              </button>
              <button className="vc-btn vc-btn-secondary" onClick={() => { setRaw(""); setOutput(""); setCounts({}); setSelectedRoles([]); updateMeta("targetName", ""); updateMeta("topic", ""); closeForm(); }} aria-label="Clear">
                <i className="ti ti-trash" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Right */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Media panel */}
          <div className="vc-card">
            <div className="vc-card-header">
              <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "1px", margin: 0, color: "var(--vc-mute)" }}>插入媒体占位符</h2>
            </div>
            <div className="vc-tag-group">
              {TYPES.map(t => (
                <button key={t.key}
                  onClick={() => activeType?.key === t.key ? closeForm() : openForm(t)}
                  disabled={!output}
                  style={{ 
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 13, fontWeight: 500,
                    borderRadius: "var(--radius-pill)",
                    border: `1px solid ${activeType?.key === t.key ? t.color : "var(--vc-hairline)"}`,
                    background: activeType?.key === t.key ? `${t.color}11` : "var(--vc-canvas)",
                    color: activeType?.key === t.key ? t.color : "var(--vc-ink)", 
                    cursor: output ? "pointer" : "not-allowed", opacity: output ? 1 : 0.5,
                    transition: "all 0.2s", outline: "none"
                  }}>
                  <i className={`ti ${t.icon}`} aria-hidden="true" style={{ fontSize: 14, color: t.color }} />
                  {t.label}
                </button>
              ))}
            </div>

            {!output && (
              <p className="vc-hint">先点「生成 Markdown」，再回到这里插入媒体内容</p>
            )}

            {/* Inline form */}
            {activeType && (
              <div style={{ marginTop: 16, padding: "16px", background: "var(--vc-canvas-soft)", borderRadius: "var(--radius-md)", border: `1px solid var(--vc-hairline)` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: activeType.color, display: "flex", alignItems: "center", gap: 6 }}>
                    <i className={`ti ${activeType.icon}`} aria-hidden="true" />{activeType.label}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--vc-mute)", maxWidth: 180, textAlign: "right" }}>{activeType.hint}</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {activeType.fields.map(f => (
                    <div key={f.k}>
                      <label className="vc-label">{f.label}</label>
                      {f.type === "textarea"
                        ? <textarea className="vc-textarea" rows={f.rows || 3} placeholder={f.ph}
                            value={formData[f.k] || ""}
                            onChange={e => setFormData(d => ({ ...d, [f.k]: e.target.value }))}
                            style={{ resize: "vertical" }} />
                        : <input className="vc-input" type="text" placeholder={f.ph}
                            value={formData[f.k] || ""}
                            onChange={e => setFormData(d => ({ ...d, [f.k]: e.target.value }))} />
                      }
                    </div>
                  ))}
                </div>

                {preview && (
                  <div style={{ marginTop: 16, padding: "12px", background: "var(--vc-canvas)", borderRadius: "var(--radius-md)", border: "1px solid var(--vc-hairline)" }}>
                    <p style={{ fontSize: 11, color: "var(--vc-mute)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>预览 (标准化路径)</p>
                    <pre style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--vc-body)", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{preview}</pre>
                  </div>
                )}

                <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                  <button className="vc-btn" onClick={doInsert}
                    style={{ flex: 1, background: activeType.color, color: "#fff" }}>
                    <i className="ti ti-plus" aria-hidden="true" />插入到光标位置
                  </button>
                  <button className="vc-btn vc-btn-secondary" onClick={closeForm}>
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Output */}
          <div className="vc-card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div className="vc-card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "1px", margin: 0, color: "var(--vc-mute)" }}>Markdown 输出</h2>
              {stats && (
                <div style={{ display: "flex", gap: 8 }}>
                  {[{ l: "消息", v: stats.msgs }, { l: "媒体", v: stats.media }, { l: "字符", v: stats.chars }].map(s => (
                    <span key={s.l} style={{ fontSize: 12, color: "var(--vc-body)", background: "var(--vc-canvas-soft)", padding: "2px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--vc-hairline)" }}>
                      {s.l} <strong style={{ color: "var(--vc-ink)", fontWeight: 600 }}>{s.v}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            <textarea ref={outputRef} className="vc-markdown-output" value={output} onChange={e => setOutput(e.target.value)}
              onMouseUp={() => { if (outputRef.current) cursorRef.current = outputRef.current.selectionStart; }}
              onKeyUp={() => { if (outputRef.current) cursorRef.current = outputRef.current.selectionStart; }}
              placeholder={"生成后的 Markdown 会出现在这里\n\n先点「生成 Markdown」，然后在想插入的位置点击定位光标，再点上方媒体按钮填写内容…"}
              style={{ flex: 1, resize: "vertical", marginBottom: 16, outline: "none", width: "100%", boxSizing: "border-box" }} />
            
            <button className="vc-btn vc-btn-primary" disabled={!output} onClick={downloadZip} style={{ width: "100%", opacity: output ? 1 : 0.4 }}>
              <i className="ti ti-file-zip" aria-hidden="true" />打包下载归档文件夹 (.zip)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
