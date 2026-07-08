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

const inputStyle = {
  fontSize: 13, padding: "6px 10px", borderRadius: "var(--border-radius-md)",
  border: "0.5px solid var(--color-border-secondary)",
  background: "var(--color-background-secondary)",
  color: "var(--color-text-primary)", outline: "none",
  width: "100%", boxSizing: "border-box",
};

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
    <div style={{ padding: "1.25rem 0", fontFamily: "var(--font-sans)" }}>
      <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 4px", color: "var(--color-text-primary)" }}>
        微信聊天记录格式化工具
      </h2>
      <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 1.25rem" }}>
        粘贴文字 → 生成 Markdown → 补充媒体内容 → 打包下载归档文件夹 (.zip)
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16 }}>
        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em" }}>元数据</p>
              
              <div style={{ display: "flex", gap: 0, border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", overflow: "hidden" }}>
                <button 
                  onClick={() => updateMeta("chatType", "single")}
                  style={{ padding: "4px 10px", fontSize: 12, border: "none", background: meta.chatType === "single" ? "var(--color-background-secondary)" : "transparent", cursor: "pointer", fontWeight: meta.chatType === "single" ? 600 : 400 }}>
                  单聊
                </button>
                <button 
                  onClick={() => updateMeta("chatType", "group")}
                  style={{ padding: "4px 10px", fontSize: 12, border: "none", borderLeft: "0.5px solid var(--color-border-secondary)", background: meta.chatType === "group" ? "var(--color-background-secondary)" : "transparent", cursor: "pointer", fontWeight: meta.chatType === "group" ? 600 : 400 }}>
                  群聊
                </button>
              </div>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <input type="text" placeholder={meta.chatType === "single" ? "聊天对象 (例: 张三)" : "群名称 (例: VIP咨询群)"} 
                value={meta.targetName} onChange={e => updateMeta("targetName", e.target.value)} 
                style={{ ...inputStyle, gridColumn: "1/-1" }} />
              <input type="text" placeholder="日期 2025-05-14" value={meta.date} onChange={e => updateMeta("date", e.target.value)} style={inputStyle} />
              <input type="text" placeholder="主题" value={meta.topic} onChange={e => updateMeta("topic", e.target.value)} style={inputStyle} />
              <input type="text" placeholder="标签（逗号分隔）" value={meta.tags} onChange={e => updateMeta("tags", e.target.value)} style={{ ...inputStyle, gridColumn: "1/-1" }} />
            </div>

            <div>
              <p style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 6 }}>参与者身份分类 (可多选)</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {PREDEFINED_ROLES.map(role => (
                  <label key={role} style={{ 
                    display: "flex", alignItems: "center", gap: 4, 
                    fontSize: 11, cursor: "pointer", padding: "4px 8px",
                    borderRadius: "var(--border-radius-md)",
                    border: selectedRoles.includes(role) ? "0.5px solid #0F6E56" : "0.5px solid var(--color-border-secondary)",
                    background: selectedRoles.includes(role) ? "#E1F5EE" : "transparent",
                    color: selectedRoles.includes(role) ? "#0F6E56" : "var(--color-text-secondary)"
                  }}>
                    <input type="checkbox" style={{ display: "none" }}
                      checked={selectedRoles.includes(role)} 
                      onChange={() => toggleRole(role)} />
                    {role}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem", flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: ".05em" }}>原始聊天记录</p>
            <textarea value={raw} onChange={e => setRaw(e.target.value)}
              placeholder={"从微信PC版复制粘贴聊天记录\n\n支持格式：\n顾问小王 10:02\n这个学校环境很好\n\n学员张同学 10:05\n有没有纯会话的课？"}
              style={{ ...inputStyle, minHeight: 200, fontFamily: "var(--font-mono)", lineHeight: 1.6, resize: "vertical", display: "block" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={generate}
                style={{ flex: 1, padding: "8px 12px", fontSize: 13, fontWeight: 500, borderRadius: "var(--border-radius-md)", border: "0.5px solid #0F6E56", background: "#E1F5EE", color: "#0F6E56", cursor: "pointer" }}>
                <i className="ti ti-sparkles" aria-hidden="true" style={{ marginRight: 6 }} />生成 Markdown
              </button>
              <button onClick={() => { setRaw(""); setOutput(""); setCounts({}); setSelectedRoles([]); updateMeta("targetName", ""); updateMeta("topic", ""); closeForm(); }}
                style={{ padding: "8px 12px", fontSize: 13, borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer" }}>
                <i className="ti ti-trash" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Right */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Media panel */}
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem" }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: ".05em" }}>插入媒体占位符 (生成 assets 路径)</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TYPES.map(t => (
                <button key={t.key}
                  onClick={() => activeType?.key === t.key ? closeForm() : openForm(t)}
                  disabled={!output}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", fontSize: 12, fontWeight: 500,
                    borderRadius: "var(--border-radius-md)",
                    border: `0.5px solid ${t.color}${activeType?.key === t.key ? "bb" : "44"}`,
                    background: activeType?.key === t.key ? `${t.color}22` : `${t.color}0e`,
                    color: t.color, cursor: output ? "pointer" : "not-allowed", opacity: output ? 1 : 0.4,
                    outline: activeType?.key === t.key ? `1.5px solid ${t.color}55` : "none" }}>
                  <i className={`ti ${t.icon}`} aria-hidden="true" style={{ fontSize: 14 }} />
                  {t.label}
                </button>
              ))}
            </div>

            {!output && (
              <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "8px 0 0" }}>
                先点「生成 Markdown」，再回到这里插入媒体内容
              </p>
            )}

            {/* Inline form */}
            {activeType && (
              <div style={{ marginTop: 12, padding: "12px", background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", border: `0.5px solid ${activeType.color}44` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: activeType.color, display: "flex", alignItems: "center", gap: 6 }}>
                    <i className={`ti ${activeType.icon}`} aria-hidden="true" />{activeType.label}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", maxWidth: 180, textAlign: "right", lineHeight: 1.4 }}>{activeType.hint}</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {activeType.fields.map(f => (
                    <div key={f.k}>
                      <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 3 }}>{f.label}</label>
                      {f.type === "textarea"
                        ? <textarea rows={f.rows || 3} placeholder={f.ph}
                            value={formData[f.k] || ""}
                            onChange={e => setFormData(d => ({ ...d, [f.k]: e.target.value }))}
                            style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-sans)", lineHeight: 1.5, display: "block" }} />
                        : <input type="text" placeholder={f.ph}
                            value={formData[f.k] || ""}
                            onChange={e => setFormData(d => ({ ...d, [f.k]: e.target.value }))}
                            style={inputStyle} />
                      }
                    </div>
                  ))}
                </div>

                {preview && (
                  <div style={{ marginTop: 10, padding: "8px 10px", background: "var(--color-background-primary)", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-tertiary)" }}>
                    <p style={{ fontSize: 10, color: "var(--color-text-tertiary)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: ".05em" }}>预览 (标准化路径)</p>
                    <pre style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{preview}</pre>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={doInsert}
                    style={{ flex: 1, padding: "7px 12px", fontSize: 13, fontWeight: 500, borderRadius: "var(--border-radius-md)", border: `0.5px solid ${activeType.color}`, background: `${activeType.color}18`, color: activeType.color, cursor: "pointer" }}>
                    <i className="ti ti-plus" aria-hidden="true" style={{ marginRight: 5 }} />插入到光标位置
                  </button>
                  <button onClick={closeForm}
                    style={{ padding: "7px 12px", fontSize: 13, borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer" }}>
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Output */}
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", margin: 0, textTransform: "uppercase", letterSpacing: ".05em" }}>Markdown 输出</p>
              {stats && (
                <div style={{ display: "flex", gap: 6 }}>
                  {[{ l: "消息", v: stats.msgs }, { l: "媒体", v: stats.media }, { l: "字符", v: stats.chars }].map(s => (
                    <span key={s.l} style={{ fontSize: 11, color: "var(--color-text-tertiary)", background: "var(--color-background-secondary)", padding: "2px 6px", borderRadius: 4 }}>
                      {s.l} {s.v}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <textarea ref={outputRef} value={output} onChange={e => setOutput(e.target.value)}
              onMouseUp={() => { if (outputRef.current) cursorRef.current = outputRef.current.selectionStart; }}
              onKeyUp={() => { if (outputRef.current) cursorRef.current = outputRef.current.selectionStart; }}
              placeholder={"生成后的 Markdown 会出现在这里\n\n先点「生成 Markdown」，然后在想插入的位置点击定位光标，再点上方媒体按钮填写内容…"}
              style={{ ...inputStyle, minHeight: 220, fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.7, resize: "vertical", display: "block" }} />
            
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button disabled={!output} onClick={downloadZip}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 12px", fontSize: 13, fontWeight: 500, borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-secondary)", background: output ? "var(--green-bg, #E1F5EE)" : "var(--color-background-secondary)", color: output ? "var(--green, #0F6E56)" : "var(--color-text-primary)", cursor: output ? "pointer" : "not-allowed", opacity: output ? 1 : 0.4 }}>
                <i className="ti ti-file-zip" aria-hidden="true" style={{ fontSize: 16 }} />
                打包下载归档文件夹 (.zip)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
