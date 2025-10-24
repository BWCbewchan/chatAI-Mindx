import { ArrowDownToLine, FileText, FolderUp, Gauge, Paperclip, Pencil, Send, Shapes, Trash2, X } from "lucide-react";
import { Children, Fragment, memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import remarkGfm from "remark-gfm";
import {
    checkServerHealth,
    exportSb3FromChat,
    fetchAdminAnalytics,
    getStudentChatHistory,
    loginAdmin,
    logoutAdmin,
    NETWORK_ERROR_MESSAGE,
    sendChatMessage,
    uploadSb3
} from "./api.js";
import Dashboard from "./Dashboard.jsx";

const initialMessage = {
  role: "assistant",
  content: `## 👋 Chào em!

### 🎯 Mục tiêu chính
- Giúp em tìm nhanh nội dung trong giáo án MindX phù hợp với câu hỏi.
- Hướng dẫn từng bước khi em làm với các khối Scratch kéo-thả.

### 🧠 Giải thích nhanh
Cô MindX luôn sẵn sàng giải thích bằng lời dễ hiểu, thêm ví dụ gần gũi và **lưu ý quan trọng** khi lập trình.

### 🎒 Gợi ý luyện tập
- Hỏi cô về nội dung của từng buổi học.
- Nhờ cô góp ý khi dự án Scratch của em chưa chạy đúng.
- Đính kèm hình ảnh hoặc tệp ghi chú để cô phân tích chi tiết hơn.

> 💡 Em có thể tải tệp \`.sb3\` để cô xem kỹ từng khối nữa nhé!
> 💡 Khi nhắc đến lệnh Scratch, cô sẽ ghi theo tiếng Anh chuẩn như \`Events > When Green Flag Clicked\`.
> 💡 Cô bắt đầu bằng cách chỉ em kéo từng khối, cuối phần Scratch sẽ ghép lại chuỗi lệnh hoàn chỉnh cho em.
`,
  references: []
};

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_SIZE_MB = 4;
const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const SUPPORTED_TEXT_TYPES = ["text/plain", "text/markdown", "application/json"];
const SUPPORTED_ATTACHMENT_TYPES = new Set([...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_TEXT_TYPES]);
const SCRATCH_LEGEND = [
  {
    category: "Events (Sự kiện)",
    example: "When Green Flag Clicked",
    className: "scratch-events",
    description: "Khởi động và gửi tín hiệu cho chương trình."
  },
  {
    category: "Motion (Chuyển động)",
    example: "Move 10 Steps",
    className: "scratch-motion",
    description: "Điều khiển vị trí và hướng của nhân vật."
  },
  {
    category: "Looks (Hiển thị)",
    example: "Say Hello!",
    className: "scratch-looks",
    description: "Thay đổi trang phục, lời thoại và hiệu ứng."
  },
  {
    category: "Sound (Âm thanh)",
    example: "Play Sound Meow",
    className: "scratch-sound",
    description: "Tạo nhạc và hiệu ứng âm thanh vui tai."
  },
  {
    category: "Control (Điều khiển)",
    example: "Repeat 10",
    className: "scratch-control",
    description: "Lặp lại, chờ và dừng hành động."
  },
  {
    category: "Sensing (Cảm biến)",
    example: "Touching Edge?",
    className: "scratch-sensing",
    description: "Nhận tín hiệu từ chuột, phím và va chạm."
  },
  {
    category: "Operators (Toán)",
    example: "Pick Random 1 to 10",
    className: "scratch-operators",
    description: "Tính toán, nối chữ và so sánh."
  },
  {
    category: "Variables (Biến)",
    example: "Set Score to 0",
    className: "scratch-variables",
    description: "Lưu điểm số, tên nhân vật và dữ liệu."
  },
  {
    category: "My Blocks (Khối tự tạo)",
    example: "Run My Block Fly Around",
    className: "scratch-myblocks",
    description: "Tạo khối riêng để tái sử dụng."
  }
];

// suggestion section removed

const INLINE_SUGGESTION_PROMPTS = [
  "Cô nhắc lại phần hoạt động của buổi 04 giúp em với?",
  "Em nên sửa phần chuyển cảnh trong buổi 07 như thế nào?",
  "Cô tạo giúp em file .sb3 với chuỗi lệnh vừa hướng dẫn nhé?"
];

const STORAGE_KEYS = {
  sessions: "mindx-stem-chat:sessions",
  currentSession: "mindx-stem-chat:current-session",
  preferences: "mindx-stem-chat:preferences",
  profile: "mindx-stem-chat:profile"
};

const DEFAULT_ANSWER_SETTINGS = {
  tone: "coach",
  detail: "balanced",
  includeScratchSteps: true,
  includePracticeIdeas: true
};

const DEFAULT_PROFILE = {
  program: "SB",
  name: "",
  grade: "",
  age: "",
  goal: "",
  favoriteTopics: "",
  notes: ""
};

function createNewSession() {
  const timestamp = Date.now();
  return {
    id: `session-${timestamp}-${Math.random().toString(16).slice(2, 8)}`,
    title: "Cuộc trò chuyện mới",
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [initialMessage],
    settingsSnapshot: { ...DEFAULT_ANSWER_SETTINGS },
    profileSnapshot: { ...DEFAULT_PROFILE }
  };
}

function deriveSessionTitle(messageList) {
  if (!Array.isArray(messageList) || messageList.length === 0) {
    return "Cuộc trò chuyện mới";
  }

  const firstUserMessage = messageList.find(
    (message) => message.role === "user" && typeof message.content === "string" && message.content.trim()
  );

  if (firstUserMessage) {
    const primaryLine = firstUserMessage.content.split("\n")[0].trim();
    if (primaryLine.length > 0) {
      return primaryLine.length > 48 ? `${primaryLine.slice(0, 48)}…` : primaryLine;
    }
  }

  const firstAssistantMessage = messageList.find(
    (message) => message.role === "assistant" && typeof message.content === "string" && message.content.trim()
  );

  if (firstAssistantMessage) {
    const assistantLine = firstAssistantMessage.content.split("\n")[0].replace(/^#+\s*/, "").trim();
    if (assistantLine.length > 0) {
      return assistantLine.length > 48 ? `${assistantLine.slice(0, 48)}…` : assistantLine;
    }
  }

  return "Cuộc trò chuyện mới";
}

function initializeState() {
  if (typeof window === "undefined") {
    const session = createNewSession();
    return {
      sessions: [session],
      currentSessionId: session.id,
      messages: session.messages,
      preferences: DEFAULT_ANSWER_SETTINGS,
      profile: DEFAULT_PROFILE
    };
  }

  const storedSessions = (() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.sessions);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const storedPreferences = (() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.preferences);
      if (!raw) return DEFAULT_ANSWER_SETTINGS;
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_ANSWER_SETTINGS,
        ...(parsed && typeof parsed === "object" ? parsed : {})
      };
    } catch {
      return DEFAULT_ANSWER_SETTINGS;
    }
  })();

  const storedProfile = (() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.profile);
      if (!raw) return DEFAULT_PROFILE;
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_PROFILE,
        ...(parsed && typeof parsed === "object" ? parsed : {})
      };
    } catch {
      return DEFAULT_PROFILE;
    }
  })();

  let currentSessionId = (() => {
    try {
      return window.localStorage.getItem(STORAGE_KEYS.currentSession) || "";
    } catch {
      return "";
    }
  })();

  let sessions = storedSessions.filter((session) =>
    session && typeof session === "object" && Array.isArray(session.messages)
  );

  if (sessions.length === 0) {
    const freshSession = createNewSession();
    sessions = [freshSession];
    currentSessionId = freshSession.id;
  } else if (!currentSessionId || !sessions.some((session) => session.id === currentSessionId)) {
    currentSessionId = sessions[0].id;
  }

  const activeSession = sessions.find((session) => session.id === currentSessionId) || sessions[0];
  const initialMessages = activeSession?.messages?.length ? activeSession.messages : [initialMessage];

  return {
    sessions,
    currentSessionId,
    messages: initialMessages,
    preferences: storedPreferences,
    profile: storedProfile
  };
}

function cloneMessagesForStorage(messageList) {
  if (!Array.isArray(messageList)) {
    return [];
  }

  return messageList.map((message) => {
    const cloned = { ...message };

    if (Array.isArray(message.attachments)) {
      cloned.attachments = message.attachments.map((attachment) => ({ ...attachment }));
    }

    if (Array.isArray(message.references)) {
      cloned.references = message.references.map((reference) => ({ ...reference }));
    }

    return cloned;
  });
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "";
  }

  try {
    return new Date(timestamp).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit"
    });
  } catch {
    return "";
  }
}

function normalizeForComparison(text) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[^a-z0-9\s]+/gi, "")
    .toLowerCase();
}

// suggestion extraction removed

const SCRATCH_CATEGORY_MAP = {
  events: "scratch-events",
  event: "scratch-events",
  su_kien: "scratch-events",
  motion: "scratch-motion",
  move: "scratch-motion",
  moves: "scratch-motion",
  chuyen_dong: "scratch-motion",
  looks: "scratch-looks",
  look: "scratch-looks",
  hien_thi: "scratch-looks",
  sound: "scratch-sound",
  sounds: "scratch-sound",
  am_thanh: "scratch-sound",
  control: "scratch-control",
  controls: "scratch-control",
  dieu_khien: "scratch-control",
  sensing: "scratch-sensing",
  sensing_blocks: "scratch-sensing",
  cam_bien: "scratch-sensing",
  operators: "scratch-operators",
  operator: "scratch-operators",
  toan: "scratch-operators",
  maths: "scratch-operators",
  math: "scratch-operators",
  variables: "scratch-variables",
  variable: "scratch-variables",
  bien: "scratch-variables",
  lists: "scratch-variables",
  list: "scratch-variables",
  my_blocks: "scratch-myblocks",
  myblocks: "scratch-myblocks",
  khoi_tu_tao: "scratch-myblocks",
  custom_blocks: "scratch-myblocks",
  custom_block: "scratch-myblocks"
};

const SCRATCH_CLASS_DISPLAY = {
  "scratch-events": "Events",
  "scratch-motion": "Motion",
  "scratch-looks": "Looks",
  "scratch-sound": "Sound",
  "scratch-control": "Control",
  "scratch-sensing": "Sensing",
  "scratch-operators": "Operators",
  "scratch-variables": "Variables",
  "scratch-myblocks": "My Blocks"
};

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Không thể đọc tệp."));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result ?? "");
    reader.onerror = () => reject(reader.error || new Error("Không thể đọc tệp."));
    reader.readAsText(file, "utf-8");
  });
}

function createAttachmentId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeCategoryName(raw) {
  if (!raw) return "";
  const trimmed = String(raw).trim().toLowerCase();
  return trimmed
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getScratchCategoryClass(text) {
  if (typeof text !== "string") return null;

  const cleaned = text.trim();
  if (!cleaned) return null;

  const matched = /([^>›]+)[>›](.+)/.exec(cleaned);
  const hasExplicitCategory = Boolean(matched);
  const categoryRaw = hasExplicitCategory ? matched[1] : "";
  const blockName = (hasExplicitCategory ? matched[2] : cleaned).trim();
  const normalizedKey = normalizeCategoryName(categoryRaw);

  const tryMapCategory = (raw, normalized) => {
    // Direct normalized map
    if (SCRATCH_CATEGORY_MAP[normalized]) return SCRATCH_CATEGORY_MAP[normalized];
    // Raw lowercase map
    const rawLower = String(raw).trim().toLowerCase();
    if (SCRATCH_CATEGORY_MAP[rawLower]) return SCRATCH_CATEGORY_MAP[rawLower];
    // First token of normalized (before underscore) e.g., "control_dieu_khien" -> "control"
    const firstToken = normalized.split("_")[0];
    if (SCRATCH_CATEGORY_MAP[firstToken]) return SCRATCH_CATEGORY_MAP[firstToken];
    // Strip parentheses in raw then lowercase
    const withoutParen = String(raw).replace(/\(.+?\)/g, "").trim().toLowerCase();
    if (SCRATCH_CATEGORY_MAP[withoutParen]) return SCRATCH_CATEGORY_MAP[withoutParen];
    // Starts-with match on normalized (e.g., "control_dieu_khien" starts with "control")
    for (const key of Object.keys(SCRATCH_CATEGORY_MAP)) {
      if (normalized.startsWith(key)) {
        return SCRATCH_CATEGORY_MAP[key];
      }
    }
    return null;
  };

  let mappedClass = tryMapCategory(categoryRaw, normalizedKey);

  const inferCategoryFromBlock = (block) => {
    const b = block.toLowerCase();
    if (/^when\s+(green\s+flag|\w+\s+key|space\s+key|this\s+sprite\s+clicked)/i.test(block)) return "scratch-events";
    if (/^(broadcast|when\s+i\s+receive)/i.test(block)) return "scratch-events";
    if (/^(set\s+\[?.+\]?\s+to|change\s+\[?.+\]?\s+by|show\s+variable|hide\s+variable)/i.test(block)) return "scratch-variables";
    if (/^(say\s+|think\s+|switch\s+costume|next\s+costume|change\s+size|set\s+size|show\b|hide\b)/i.test(block)) return "scratch-looks";
    if (/^(play\s+sound|start\s+sound|change\s+volume|set\s+volume)/i.test(block)) return "scratch-sound";
    if (/^(move\s+\d+\s+steps|turn\s+|go\s+to|glide\s+|point\s+in\s+direction)/i.test(block)) return "scratch-motion";
    return null;
  };

  // If mapping is missing or incorrectly labeled as control while block clearly matches other group, fix it
  const inferred = inferCategoryFromBlock(blockName);
  if (!mappedClass && inferred) {
    mappedClass = inferred;
  } else if (mappedClass === "scratch-control" && inferred && inferred !== "scratch-control") {
    mappedClass = inferred;
  }

  const displayCategory = SCRATCH_CLASS_DISPLAY[mappedClass] || (categoryRaw ? categoryRaw.trim() : SCRATCH_CLASS_DISPLAY[mappedClass] || "");

  if (!mappedClass) {
    return null;
  }

  return {
    className: mappedClass,
    category: displayCategory,
    block: blockName
  };
}

function formatAttachmentSnippet(snippet) {
  if (!snippet) return "";
  const singleLine = snippet.replace(/\s+/g, " ").trim();
  if (!singleLine) {
    return "";
  }
  return singleLine.length > 80 ? `${singleLine.slice(0, 80)}…` : singleLine;
}

function getTextContent(node) {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) {
    return node.join("");
  }

  return Children.toArray(node)
    .map((child) => (typeof child === "string" ? child : ""))
    .join("");
}

function parseScratchStack(text) {
  if (!text) return null;

  const cleaned = text.replace(/\r/g, "").trim();
  if (!cleaned) return null;

  const lines = cleaned
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return null;
  }

  const result = [];
  let currentIndent = 0;

  const isEndLine = (s) => /(^|\b)(end|end if|end forever|kết thúc)($|\b)/i.test(s);
  const isElseLine = (s) => /(^|\b)(else|nếu không)($|\b)/i.test(s);
  const opensBlock = (chips) =>
    chips.some((c) =>
      (c.className === "scratch-control" && /^(if\b|repeat\b|forever\b)/i.test(c.block)) ||
      (c.className === "scratch-events" && /^when\s+/i.test(c.block))
    );

  for (const rawLine of lines) {
    const stripped = rawLine
      .replace(/^[-*•\u2022➤\d.)\s]+/, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!stripped) {
      continue;
    }

    // Dedent before processing if the line is an END or ELSE
    let lineIndent = currentIndent;
    if (isEndLine(stripped)) {
      currentIndent = Math.max(0, currentIndent - 1);
      lineIndent = currentIndent;
    } else if (isElseLine(stripped)) {
      currentIndent = Math.max(0, currentIndent - 1);
      lineIndent = currentIndent; // else stays at the same level as the if-block
    }

    let commandSequence = stripped;
    const colonIndex = stripped.lastIndexOf(":");
    if (colonIndex !== -1) {
      const trailing = stripped.slice(colonIndex + 1).trim();
      if (trailing.includes(">")) {
        commandSequence = trailing;
      }
    }

    const segments = commandSequence
      .split(/\s*(?:->|→|⇒|=>|\+|,|;)\s*/)
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (!segments.length) {
      // Treat as a control label line (e.g., Else / End)
      result.push({
        chips: [
          {
            className: "scratch-control",
            category: "Control",
            block: stripped
          }
        ],
        indent: lineIndent
      });
      continue;
    }

    const chips = [];

    for (const segment of segments) {
      const info = getScratchCategoryClass(segment);
      if (!info) {
        // Fallback per-segment to keep other segments' colors
        chips.push({ className: "scratch-control", category: "Control", block: segment });
      } else {
        chips.push(info);
      }
    }

    result.push({ chips, indent: lineIndent });

    // Increase indent after lines that open a block
    if (opensBlock(chips)) {
      currentIndent += 1;
    }
  }

  return result.length ? result : null;
}

const markdownComponents = {
  h2: (props) => <h2 className="markdown-title" {...props} />,
  h3: (props) => <h3 className="markdown-subtitle" {...props} />,
  strong: (props) => <strong className="markdown-highlight" {...props} />,
  code: ({ inline, className, children, ...props }) => {
    const textContent = getTextContent(children);

    if (inline) {
      const scratchInfo = getScratchCategoryClass(textContent);

      if (scratchInfo) {
        return (
          <span className={`scratch-chip ${scratchInfo.className}`} {...props}>
            <span className="scratch-chip-category">{scratchInfo.category}</span>
            <span className="scratch-chip-arrow" aria-hidden="true">
              ›
            </span>
            <span className="scratch-chip-block">{scratchInfo.block}</span>
          </span>
        );
      }

      return (
        <code className={`markdown-code inline ${className ?? ""}`} {...props}>
          {children}
        </code>
      );
    }

    const scratchStack = parseScratchStack(textContent);

    if (scratchStack) {
      return (
        <div className="scratch-stack" {...props}>
          {(() => {
            let stepCounter = 0;
            const isNonActionControl = (row) =>
              row.chips.length === 1 &&
              row.chips[0].className === "scratch-control" &&
              /^(else|end|kết thúc)/i.test(row.chips[0].block);

            return scratchStack.map((row, rowIndex) => {
              const isAction = !isNonActionControl(row);
              const maybeStep = isAction ? (stepCounter += 1) : null;
              return (
                <div
                  className="scratch-stack-row"
                  key={`scratch-row-${rowIndex}`}
                  style={{ paddingLeft: `${(row.indent || 0) * 18}px` }}
                >
                  {maybeStep && <span className="scratch-step" aria-hidden="true">{maybeStep}</span>}
                  {row.chips.map((chip, chipIndex) => (
                    <Fragment key={`scratch-chip-${rowIndex}-${chipIndex}-${chip.block}`}>
                      <span className={`scratch-chip ${chip.className}`}>
                        <span className="scratch-chip-category">{chip.category}</span>
                        <span className="scratch-chip-arrow" aria-hidden="true">›</span>
                        <span className="scratch-chip-block">{chip.block}</span>
                      </span>
                      {chipIndex < row.chips.length - 1 && (
                        <span
                          className="scratch-stack-arrow"
                          aria-hidden="true"
                          style={{ color: "rgba(15,23,42,0.35)" }}
                        >
                          →
                        </span>
                      )}
                    </Fragment>
                  ))}
                </div>
              );
            });
          })()}
        </div>
      );
    }

    return (
      <pre className="markdown-pre">
        <code className={`markdown-code block ${className ?? ""}`} {...props}>
          {children}
        </code>
      </pre>
    );
  },
  blockquote: (props) => <blockquote className="markdown-quote" {...props} />,
  ul: (props) => <ul className="markdown-list" {...props} />,
  ol: (props) => <ol className="markdown-list" {...props} />
};

function AttachmentPreview({ attachment }) {
  if (attachment.kind === "image" && attachment.preview) {
    return (
      <figure className="attachment-item image">
        <img src={attachment.preview} alt={attachment.name} loading="lazy" />
        <figcaption>
          <span className="attachment-name">{attachment.name}</span>
          <span className="attachment-meta">{attachment.sizeLabel}</span>
        </figcaption>
      </figure>
    );
  }

  return (
    <div className="attachment-item file">
      <div className="attachment-icon" aria-hidden="true">
        📎
      </div>
      <div className="attachment-text">
        <span className="attachment-name">{attachment.name}</span>
        <span className="attachment-meta">{attachment.sizeLabel}</span>
        {attachment.snippet && <pre>{attachment.snippet}</pre>}
      </div>
    </div>
  );
}

const MessageBubble = memo(function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`message ${isUser ? "user" : "assistant"}`}>
      <div className="message-body">
        <ReactMarkdown
          className="message-markdown"
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {message.content}
        </ReactMarkdown>
        {!!message.attachments?.length && (
          <div className="message-attachments">
            {message.attachments.map((attachment) => (
              <AttachmentPreview key={attachment.id || attachment.name} attachment={attachment} />
            ))}
          </div>
        )}
        {!!message.references?.length && (
          <ul className="references">
            {message.references.map((ref) => (
              <li key={ref.id}>Nguồn: {ref.title}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  const a = prev.message;
  const b = next.message;
  if (a === b) return true;
  if (a.role !== b.role || a.content !== b.content) return false;
  const aRefs = a.references || [];
  const bRefs = b.references || [];
  if (aRefs.length !== bRefs.length) return false;
  const aAtt = a.attachments || [];
  const bAtt = b.attachments || [];
  if (aAtt.length !== bAtt.length) return false;
  return true;
});

const MessagesList = memo(function MessagesList({ items, onScroll, chatRef }) {
  return (
    <section className="chat" ref={chatRef} onScroll={onScroll}>
      {items.map((message, index) => (
        <MessageBubble key={index} message={message} />
      ))}
    </section>
  );
});

function StatusIndicator({ status }) {
  if (!status) {
    return null;
  }

  return (
    <div className={`status-indicator ${status.type}`} role="status" aria-live="polite">
      <span className="status-dot" aria-hidden="true" />
      <span className="status-label">{status.label}</span>
    </div>
  );
}

export default function App() {
  const initialState = useMemo(() => initializeState(), []);
  const location = useLocation();
  const navigate = useNavigate();
  const activePath = location.pathname?.toLowerCase?.() || "/";
  const activeView = activePath === "/dashboard" ? "admin" : "chat";
  const [sessions, setSessions] = useState(initialState.sessions);
  const [currentSessionId, setCurrentSessionId] = useState(initialState.currentSessionId);
  const [messages, setMessages] = useState(initialState.messages);
  const [answerSettings, setAnswerSettings] = useState(initialState.preferences);
  const [userProfile, setUserProfile] = useState(initialState.profile);
  const [pending, setPending] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [input, setInput] = useState("");
  const deferredInput = useDeferredValue(input);
  const [sb3Report, setSb3Report] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const chatRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [showLegendPanel, setShowLegendPanel] = useState(false);
  // suggestion UI removed
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [activeNavTab, setActiveNavTab] = useState("history");
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.matchMedia("(min-width: 1024px)").matches;
  });
  const [adminUsername, setAdminUsername] = useState("admin");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminToken, setAdminToken] = useState(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return window.sessionStorage.getItem("mindx-admin-token");
  });
  const [adminLoginError, setAdminLoginError] = useState(null);
  const [adminLoginPending, setAdminLoginPending] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [analyticsLastUpdated, setAnalyticsLastUpdated] = useState(null);
  const [serverOnline, setServerOnline] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [classFilter, setClassFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [studentChatHistory, setStudentChatHistory] = useState([]);
  const [studentChatLoading, setStudentChatLoading] = useState(false);

  const isAdminAuthenticated = Boolean(adminToken);
  const numberFormatter = useMemo(() => new Intl.NumberFormat("vi-VN"), []);
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }),
    []
  );
  const shortDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit"
      }),
    []
  );

  const scrollChatToBottom = useCallback((behavior = "smooth") => {
    const node = chatRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior });
  }, []);

  const updateScrollButtonVisibility = useCallback(() => {
    const node = chatRef.current;
    if (!node) return;
    const distanceFromBottom = node.scrollHeight - (node.scrollTop + node.clientHeight);
    setShowScrollButton(distanceFromBottom > 120);
  }, []);

  useEffect(() => {
    updateScrollButtonVisibility();
  }, [messages, updateScrollButtonVisibility]);

  useEffect(() => {
    if (!showScrollButton) {
      scrollChatToBottom(messages.length <= 1 ? "auto" : "smooth");
    }
  }, [messages, showScrollButton, scrollChatToBottom]);

  useEffect(() => {
    if (!showUploadPanel && !showLegendPanel && !isNavOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowUploadPanel(false);
        setShowLegendPanel(false);
        setIsNavOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showUploadPanel, showLegendPanel, isNavOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.currentSession, currentSessionId);
  }, [currentSessionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(answerSettings));
  }, [answerSettings]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let isCancelled = false;

    const probe = async () => {
      try {
        await checkServerHealth();
        if (!isCancelled) {
          setServerOnline(true);
        }
      } catch (error) {
        if (!isCancelled) {
          setServerOnline(false);
        }
      }
    };

    probe();
    const intervalId = window.setInterval(probe, 5000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (adminToken) {
      window.sessionStorage.setItem("mindx-admin-token", adminToken);
    } else {
      window.sessionStorage.removeItem("mindx-admin-token");
    }
  }, [adminToken]);

  // Kiểm tra thông tin profile khi component mount
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const isProfileComplete = userProfile.name.trim() && userProfile.grade.trim() && userProfile.age.trim();
    if (!isProfileComplete && activeView === "chat" && !isAdminAuthenticated) {
      setShowProfileModal(true);
    } else if (isProfileComplete || activeView === "admin") {
      setShowProfileModal(false);
    }
  }, [userProfile, activeView, isAdminAuthenticated]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    const updateDesktopFlag = (event) => {
      setIsDesktop(event.matches);
    };

    updateDesktopFlag(mediaQuery);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateDesktopFlag);
      return () => mediaQuery.removeEventListener("change", updateDesktopFlag);
    }

    mediaQuery.addListener(updateDesktopFlag);
    return () => mediaQuery.removeListener(updateDesktopFlag);
  }, []);

  useEffect(() => {
    if (isDesktop) {
      setIsNavOpen(true);
    }
  }, [isDesktop]);

  useEffect(() => {
    if (pending || !currentSessionId) {
      return;
    }

    setSessions((prevSessions) => {
      const now = Date.now();
      const messageSnapshot = cloneMessagesForStorage(messages);
      const existingIndex = prevSessions.findIndex((session) => session.id === currentSessionId);
      const baseSession = existingIndex >= 0 ? prevSessions[existingIndex] : createNewSession();
      const updatedSession = {
        ...baseSession,
        id: currentSessionId,
        title: deriveSessionTitle(messages),
        messages: messageSnapshot,
        updatedAt: now,
        settingsSnapshot: { ...answerSettings },
        profileSnapshot: { ...userProfile }
      };

      if (!updatedSession.createdAt) {
        updatedSession.createdAt = now;
      }

      const remainingSessions = prevSessions.filter((session) => session.id !== currentSessionId);
      return [updatedSession, ...remainingSessions];
    });
  }, [messages, pending, currentSessionId, answerSettings, userProfile]);

  const addAttachments = useCallback(async (files) => {
    if (!files || files.length === 0) {
      return;
    }

    const normalized = Array.from(files);
    const prepared = [];
    const warnings = [];

    for (const file of normalized) {
      if (!SUPPORTED_ATTACHMENT_TYPES.has(file.type)) {
        warnings.push(`Tệp ${file.name} (${file.type || "không rõ"}) chưa được hỗ trợ.`);
        continue;
      }

      if (file.size > MAX_ATTACHMENT_BYTES) {
        warnings.push(
          `Tệp ${file.name} lớn hơn ${MAX_ATTACHMENT_SIZE_MB}MB và chưa được thêm. Vui lòng chọn tệp nhỏ hơn.`
        );
        continue;
      }

      const item = {
        id: createAttachmentId(),
        file,
        name: file.name,
        type: file.type,
        size: file.size,
        sizeLabel: formatFileSize(file.size),
        kind: SUPPORTED_IMAGE_TYPES.includes(file.type) ? "image" : "text",
        preview: null,
        snippet: null
      };

      try {
        if (item.kind === "image") {
          item.preview = await readFileAsDataUrl(file);
        } else {
          const textContent = await readFileAsText(file);
          item.snippet = textContent.slice(0, 160);
        }
      } catch {
        warnings.push(`Không thể đọc tệp ${file.name}.`);
        continue;
      }

      prepared.push(item);
    }

    setAttachments((prev) => {
      if (prepared.length === 0) {
        return prev;
      }

      const availableSlots = MAX_ATTACHMENTS - prev.length;
      if (availableSlots <= 0) {
        warnings.push(`Chỉ được đính kèm tối đa ${MAX_ATTACHMENTS} tệp mỗi tin nhắn.`);
        return prev;
      }

      const accepted = prepared.slice(0, availableSlots);
      if (prepared.length > availableSlots) {
        warnings.push(`${prepared.length - availableSlots} tệp vượt quá giới hạn và chưa được thêm.`);
      }

      return [...prev, ...accepted];
    });

    setError(warnings.length ? warnings.join(" ") : null);
  }, [setError]);

  const handleAttachmentRemove = useCallback((id) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const retrieveAnalytics = useCallback(
    async (tokenOverride, classFilterParam) => {
      const effectiveToken = tokenOverride ?? adminToken;
      if (!effectiveToken) {
        return;
      }

      setAnalyticsLoading(true);
      setAnalyticsError(null);

      try {
        const data = await fetchAdminAnalytics(effectiveToken, classFilterParam);
        setAnalyticsData(data);
        setAnalyticsLastUpdated(Date.now());
        setServerOnline(true);
      } catch (error) {
        const message = error?.message || "Không thể tải dữ liệu thống kê.";

        if (message === NETWORK_ERROR_MESSAGE) {
          setServerOnline(false);
          setAnalyticsError(message);
        } else if (error.status === 401 || error.status === 403) {
          setAdminToken(null);
          setAnalyticsData(null);
          setAnalyticsError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        } else {
          setAnalyticsError(message);
          setServerOnline(true);
        }
      } finally {
        setAnalyticsLoading(false);
      }
    },
    [adminToken]
  );

  useEffect(() => {
    if (activeView === "admin" && adminToken) {
      retrieveAnalytics();
    }
  }, [activeView, adminToken, retrieveAnalytics]);

  const handleAdminLogin = useCallback(
    async (event) => {
      event.preventDefault();
      setAdminLoginPending(true);
      setAdminLoginError(null);

      try {
        const trimmedUsername = adminUsername.trim();
        const result = await loginAdmin({
          username: trimmedUsername,
          password: adminPassword
        });
        setServerOnline(true);

        if (result?.token) {
          setAdminToken(result.token);
          navigate("/dashboard");
          setAdminPassword("");
          await retrieveAnalytics(result.token);
        } else {
          setAdminLoginError("Máy chủ không trả về mã đăng nhập.");
        }
      } catch (error) {
        const message = error?.message || "Không thể đăng nhập quản trị.";
        setAdminLoginError(message);
        if (message === NETWORK_ERROR_MESSAGE) {
          setServerOnline(false);
        }
      } finally {
        setAdminLoginPending(false);
      }
    },
    [adminUsername, adminPassword, retrieveAnalytics, navigate]
  );

  const handleAdminLogout = useCallback(async () => {
    if (adminToken) {
      try {
        await logoutAdmin(adminToken);
      } catch (error) {
        console.warn("Không thể đăng xuất quản trị:", error);
      }
    }

    setAdminToken(null);
    setAnalyticsData(null);
    setAnalyticsError(null);
    navigate("/");
  }, [adminToken, navigate]);

  const handleSwitchToAdmin = useCallback(() => {
    navigate("/dashboard");
    setShowUploadPanel(false);
    setShowLegendPanel(false);
    if (!isDesktop) {
      setIsNavOpen(false);
    }
  }, [isDesktop, navigate]);

  const handleReturnToChat = useCallback(() => {
    navigate("/");
    setAnalyticsError(null);
    // Kiểm tra lại profile khi quay về chat
    const isProfileComplete = userProfile.name.trim() && userProfile.grade.trim() && userProfile.age.trim();
    if (!isProfileComplete) {
      setShowProfileModal(true);
    }
  }, [navigate, userProfile]);

  const handleClassFilterChange = useCallback((value) => {
    setClassFilter(value);
  }, []);

  const handleClassClick = useCallback((classCode) => {
    if (selectedClass === classCode) {
      // Toggle off - clear selection
      setSelectedClass("");
      setClassFilter("");
    } else {
      // Select new class
      setSelectedClass(classCode);
      setClassFilter(classCode);
    }
  }, [selectedClass]);

  const handleStudentClick = useCallback(async (studentName) => {
    setSelectedStudent(studentName);
    setStudentModalOpen(true);
    setStudentChatLoading(true);
    
    try {
      const chatHistory = await getStudentChatHistory(adminToken, studentName, classFilter);
      setStudentChatHistory(chatHistory);
    } catch (error) {
      console.error("Error loading student chat history:", error);
      setStudentChatHistory([]);
    } finally {
      setStudentChatLoading(false);
    }
  }, [adminToken, classFilter]);

  const handleCloseStudentModal = useCallback(() => {
    setStudentModalOpen(false);
    setSelectedStudent("");
    setStudentChatHistory([]);
  }, []);

  // Auto-apply filter with debounce
  useEffect(() => {
    if (!adminToken) return;
    
    const timeoutId = setTimeout(() => {
      retrieveAnalytics(adminToken, classFilter);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [classFilter, adminToken, retrieveAnalytics]);

  const handleToggleNav = useCallback(() => {
    setIsNavOpen((prev) => !prev);
  }, []);

  const handleAttachmentInputChange = useCallback(
    async (event) => {
      const files = event.target.files;
      if (!files || files.length === 0) {
        return;
      }

      await addAttachments(files);
      event.target.value = "";
    },
    [addAttachments]
  );

  const handleAttachmentButton = () => {
    attachmentInputRef.current?.click();
  };

  const handleChatScroll = useCallback(() => {
    updateScrollButtonVisibility();
  }, [updateScrollButtonVisibility]);

  const handlePasteIntoComposer = useCallback(
    (event) => {
      const clipboardFiles = event.clipboardData?.files;
      if (!clipboardFiles || clipboardFiles.length === 0) {
        return;
      }

      const supportedFiles = Array.from(clipboardFiles).filter((file) =>
        SUPPORTED_ATTACHMENT_TYPES.has(file.type)
      );

      if (supportedFiles.length === 0) {
        return;
      }

      event.preventDefault();
      void addAttachments(supportedFiles);
    },
    [addAttachments]
  );

  const handleSend = async () => {
    const messageContent = input.trim();
    if ((messageContent.length === 0 && attachments.length === 0) || pending || showProfileModal) return;

    const displayContent = messageContent || "*(Không có nội dung, chỉ gửi tệp đính kèm)*";
    const messageForModel = messageContent || "Học sinh không nhập câu hỏi mà chỉ gửi tệp đính kèm.";
    const attachmentsForMessage = attachments.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      sizeLabel: item.sizeLabel,
      kind: item.kind,
      preview: item.preview,
      snippet: item.snippet
    }));

    const userMessage = { role: "user", content: displayContent, attachments: attachmentsForMessage };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setPending(true);
    setError(null);

    try {
      const response = await sendChatMessage({
        message: messageForModel,
        history: nextMessages.map(({ role, content }) => ({ role, content })),
        sb3Report: sb3Report?.report,
        attachments: attachments.map((item) => item.file),
        preferences: answerSettings,
        profile: userProfile,
        sessionId: currentSessionId
      });
      setServerOnline(true);

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: response.reply,
          references: response.references
        }
      ]);
      setAttachments([]);
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = "";
      }
    } catch (err) {
      console.error(err);
      const errorMessage = typeof err?.message === "string" && err.message.trim()
        ? err.message.trim()
        : "Yêu cầu thất bại";
      setError(errorMessage);

      if (errorMessage === NETWORK_ERROR_MESSAGE) {
        setServerOnline(false);
        setMessages([
          ...nextMessages,
          {
            role: "assistant",
            content: NETWORK_ERROR_MESSAGE,
            references: []
          }
        ]);
      } else {
        setServerOnline(true);
        setMessages(nextMessages);
      }
    } finally {
      setPending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = useCallback(
    (prompt) => {
      setInput((prev) => {
        const trimmedPrev = prev.trim();
        if (!trimmedPrev) {
          return prompt;
        }
        if (trimmedPrev.endsWith("?")) {
          return `${trimmedPrev} ${prompt}`;
        }
        return `${trimmedPrev}
${prompt}`;
      });
      scrollChatToBottom("smooth");
    },
    [scrollChatToBottom]
  );

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPending(true);
    setError(null);
    try {
      const result = await uploadSb3(file);
      setServerOnline(true);
      setSb3Report(result);
      const feedback = result.aiFeedback
        ? result.aiFeedback
        : "Cô đã phân tích dự án và ghi nhận một vài điểm đáng chú ý. Hãy hỏi cô nếu muốn xem gợi ý cụ thể nhé!";

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `## 📝 Cô đã xem dự án "${file.name}"\n\n${feedback}`,
          references: []
        }
      ]);
    } catch (err) {
      console.error(err);
      const message = err?.message || "Không thể tải tệp";
      setError(message);
      if (message === NETWORK_ERROR_MESSAGE) {
        setServerOnline(false);
      }
    } finally {
      setPending(false);
      event.target.value = "";
    }
  };

  const clearSb3Report = () => {
    setSb3Report(null);
  };

  const handleStartNewSession = useCallback(() => {
    const newSession = createNewSession();
    setSessions((prevSessions) => [newSession, ...prevSessions]);
    setCurrentSessionId(newSession.id);
    setMessages(newSession.messages);
    setAnswerSettings({ ...DEFAULT_ANSWER_SETTINGS });
    setUserProfile({ ...DEFAULT_PROFILE });
    setSb3Report(null);
    setAttachments([]);
    setInput("");
    setError(null);
    // Hiển thị modal profile khi tạo session mới
    setShowProfileModal(true);
    if (!isDesktop) {
      setIsNavOpen(false);
    }
    setActiveNavTab("history");
    requestAnimationFrame(() => scrollChatToBottom("auto"));
  }, [isDesktop, scrollChatToBottom]);

  const handleSelectSession = useCallback(
    (sessionId) => {
      if (sessionId === currentSessionId) {
        setIsNavOpen(false);
        return;
      }

      const session = sessions.find((item) => item.id === sessionId);
      if (!session) {
        return;
      }

      setCurrentSessionId(sessionId);
      setMessages(session.messages?.length ? session.messages : [initialMessage]);
  setAnswerSettings({ ...DEFAULT_ANSWER_SETTINGS, ...(session.settingsSnapshot || {}) });
  setUserProfile({ ...DEFAULT_PROFILE, ...(session.profileSnapshot || {}) });
      setSb3Report(null);
      setAttachments([]);
      setInput("");
      setError(null);
      // suggestion UI removed
      if (!isDesktop) {
        setIsNavOpen(false);
      }
      requestAnimationFrame(() => scrollChatToBottom("auto"));
    },
    [sessions, currentSessionId, isDesktop, scrollChatToBottom]
  );

  const handleDeleteSession = useCallback(
    (sessionId) => {
      setSessions((prevSessions) => {
        const remaining = prevSessions.filter((session) => session.id !== sessionId);

        if (remaining.length === 0) {
          const freshSession = createNewSession();
          setCurrentSessionId(freshSession.id);
          setMessages(freshSession.messages);
          setAnswerSettings({ ...DEFAULT_ANSWER_SETTINGS });
          setUserProfile({ ...DEFAULT_PROFILE });
          setSb3Report(null);
          setAttachments([]);
          setInput("");
          setError(null);
      // suggestion UI removed
          setActiveNavTab("history");
          if (!isDesktop) {
            setIsNavOpen(false);
          }
          requestAnimationFrame(() => scrollChatToBottom("auto"));
          return [freshSession];
        }

        if (sessionId === currentSessionId) {
          const nextSession = remaining[0];
          setCurrentSessionId(nextSession.id);
          setMessages(nextSession.messages?.length ? nextSession.messages : [initialMessage]);
          setAnswerSettings({ ...DEFAULT_ANSWER_SETTINGS, ...(nextSession.settingsSnapshot || {}) });
          setUserProfile({ ...DEFAULT_PROFILE, ...(nextSession.profileSnapshot || {}) });
          setSb3Report(null);
          setAttachments([]);
          setInput("");
          setError(null);
          // suggestion UI removed
          setActiveNavTab("history");
          if (!isDesktop) {
            setIsNavOpen(false);
          }
          requestAnimationFrame(() => scrollChatToBottom("auto"));
        }

        return remaining;
      });
    },
    [isDesktop, currentSessionId, scrollChatToBottom]
  );

  const handleRenameSession = useCallback((sessionId, nextTitle) => {
    const trimmedTitle = nextTitle.trim();
    if (!trimmedTitle) {
      return;
    }

    setSessions((prevSessions) =>
      prevSessions.map((session) =>
        session.id === sessionId ? { ...session, title: trimmedTitle, updatedAt: Date.now() } : session
      )
    );
  }, []);

  const handleAnswerSettingChange = useCallback((field, value) => {
    setAnswerSettings((prev) => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleProfileChange = useCallback((field, value) => {
    setUserProfile((prev) => {
      const updated = {
        ...prev,
        [field]: value
      };
      
      // Kiểm tra nếu profile đã đầy đủ thì đóng modal
      const isProfileComplete = updated.name.trim() && updated.grade.trim() && updated.age.trim();
      if (isProfileComplete && showProfileModal) {
        setShowProfileModal(false);
      }
      
      return updated;
    });
  }, [showProfileModal]);

  const latestScratchContent = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role !== "assistant" || typeof message.content !== "string") {
        continue;
      }

      const scratchPattern = /`[^`]*>[^`]*`|(?:^|\n)[^`]*>[^`]*(?:\n|$)/;
      if (scratchPattern.test(message.content)) {
        return message.content;
      }
    }
    return null;
  }, [messages]);

  // suggestion derivation removed

  const status = useMemo(() => {
    if (exporting) {
      return { type: "exporting", label: "🛠️ Cô đang tạo file .sb3 cho em..." };
    }
    if (pending) {
      return { type: "thinking", label: "🤔 Cô MindX đang suy nghĩ câu trả lời hay nhất..." };
    }
    if (deferredInput.trim().length > 0) {
      return { type: "typing", label: "✍️ Em đang gõ tin nhắn. Cứ thoải mái viết nhé!" };
    }
    return { type: "idle", label: "🌟 Cô luôn sẵn sàng lắng nghe." };
  }, [exporting, pending, deferredInput]);

  const handleExportSb3 = async () => {
    if (!latestScratchContent || exporting) {
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const blob = await exportSb3FromChat(latestScratchContent);
      setServerOnline(true);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "MindX-Assistant.sb3";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "🎉 Cô đã tạo xong dự án Scratch từ các khối vừa hướng dẫn. Em hãy mở file MindX-Assistant.sb3 trong Scratch để xem chương trình chạy nhé!",
          references: []
        }
      ]);
    } catch (err) {
      console.error(err);
      const message = err?.message || "Không thể xuất file .sb3";
      setError(message);
      if (message === NETWORK_ERROR_MESSAGE) {
        setServerOnline(false);
      }
    } finally {
      setExporting(false);
    }
  };

  const chatRouteElement = (
    <>
      <main>
        <aside className={`nav-drawer ${isNavOpen ? "open" : ""} ${isDesktop ? "desktop" : "mobile"}`}>
          <div className="nav-header">
            <div className="nav-title">
              <h2>Điều hướng</h2>
              <p>Quản lý cuộc trò chuyện và cài đặt cá nhân.</p>
            </div>
            <button type="button" className="nav-dashboard" onClick={handleSwitchToAdmin}>
              <Gauge size={16} style={{ marginRight: 6 }} /> Dashboard
            </button>
            <button
              type="button"
              className="nav-close"
              onClick={handleToggleNav}
              aria-label={isDesktop ? "Thu gọn điều hướng" : "Đóng điều hướng"}
            >
              {isDesktop ? "<" : <X size={18} />}
            </button>
          </div>

          <div className="nav-tabs" role="tablist">
            <button
              type="button"
              className={`nav-tab ${activeNavTab === "history" ? "active" : ""}`}
              onClick={() => setActiveNavTab("history")}
              role="tab"
              aria-selected={activeNavTab === "history"}
            >
              💬 Lịch sử chat
            </button>
            <button
              type="button"
              className={`nav-tab ${activeNavTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveNavTab("settings")}
              role="tab"
              aria-selected={activeNavTab === "settings"}
            >
              ⚙️ Cài đặt trả lời
            </button>
            <button
              type="button"
              className={`nav-tab ${activeNavTab === "profile" ? "active" : ""}`}
              onClick={() => setActiveNavTab("profile")}
              role="tab"
              aria-selected={activeNavTab === "profile"}
            >
              👤 Thông tin học sinh
            </button>
          </div>

          <div className="nav-content">
            {activeNavTab === "history" && (
              <div className="nav-section" role="tabpanel" aria-label="Lịch sử cuộc trò chuyện">
                <button type="button" className="nav-primary" onClick={handleStartNewSession}>
                  ＋ Cuộc trò chuyện mới
                </button>
                <div className="session-list">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`session-item ${session.id === currentSessionId ? "active" : ""}`}
                    >
                      <button
                        type="button"
                        className="session-button"
                        onClick={() => handleSelectSession(session.id)}
                      >
                        <span className="session-title">{session.title}</span>
                        <span className="session-meta">
                          {formatTimestamp(session.updatedAt || session.createdAt)}
                        </span>
                      </button>
                      <div className="session-actions">
                        <button
                          type="button"
                          aria-label="Đổi tên cuộc trò chuyện"
                          onClick={(event) => {
                            event.stopPropagation();
                            const nextTitle = window.prompt("Đổi tên cuộc trò chuyện", session.title);
                            if (typeof nextTitle === "string") {
                              handleRenameSession(session.id, nextTitle);
                            }
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label="Xóa cuộc trò chuyện"
                          onClick={(event) => {
                            event.stopPropagation();
                            const confirmDelete = window.confirm("Bạn chắc chắn muốn xóa cuộc trò chuyện này?");
                            if (confirmDelete) {
                              handleDeleteSession(session.id);
                            }
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {sessions.length === 0 && <p className="session-empty">Chưa có cuộc trò chuyện nào.</p>}
                </div>
              </div>
            )}

            {activeNavTab === "settings" && (
              <div className="nav-section" role="tabpanel" aria-label="Cài đặt trả lời">
                <div className="nav-field">
                  <label htmlFor="setting-tone">Giọng trả lời</label>
                  <select
                    id="setting-tone"
                    value={answerSettings.tone}
                    onChange={(event) => handleAnswerSettingChange("tone", event.target.value)}
                  >
                    <option value="coach">Nhẹ nhàng như cô hướng dẫn</option>
                    <option value="enthusiastic">Sôi nổi, truyền cảm hứng</option>
                    <option value="concise">Ngắn gọn, thẳng trọng tâm</option>
                  </select>
                </div>

                <div className="nav-field">
                  <label htmlFor="setting-detail">Mức độ chi tiết</label>
                  <select
                    id="setting-detail"
                    value={answerSettings.detail}
                    onChange={(event) => handleAnswerSettingChange("detail", event.target.value)}
                  >
                    <option value="concise">Ngắn gọn</option>
                    <option value="balanced">Vừa đủ</option>
                    <option value="deep">Đào sâu từng bước</option>
                  </select>
                </div>

                <label className="nav-checkbox">
                  <input
                    type="checkbox"
                    checked={answerSettings.includeScratchSteps}
                    onChange={(event) => handleAnswerSettingChange("includeScratchSteps", event.target.checked)}
                  />
                  <span>Luôn hướng dẫn từng bước với các khối Scratch</span>
                </label>

                <label className="nav-checkbox">
                  <input
                    type="checkbox"
                    checked={answerSettings.includePracticeIdeas}
                    onChange={(event) => handleAnswerSettingChange("includePracticeIdeas", event.target.checked)}
                  />
                  <span>Gợi ý thêm hoạt động luyện tập cuối mỗi câu trả lời</span>
                </label>
              </div>
            )}

            {activeNavTab === "profile" && (
              <div className="nav-section" role="tabpanel" aria-label="Thông tin học sinh">
                <div className="nav-field">
                  <label htmlFor="profile-program">Khóa học</label>
                  <select
                    id="profile-program"
                    value={userProfile.program || ""}
                    onChange={(event) => handleProfileChange("program", event.target.value)}
                  >
                    <option value="SB">SB - Scratch Beginner</option>
                    <option value="SA">SA - Scratch Advanced</option>
                    <option value="SI">SI - Scratch Intensive</option>
                  </select>
                </div>
                <div className="nav-field">
                  <label htmlFor="profile-name">Tên của em</label>
                  <input
                    id="profile-name"
                    type="text"
                    value={userProfile.name}
                    onChange={(event) => handleProfileChange("name", event.target.value)}
                    placeholder="VD: Minh Anh"
                    autoComplete="off"
                  />
                </div>

                <div className="nav-field">
                  <label htmlFor="profile-grade">Lớp</label>
                  <input
                    id="profile-grade"
                    type="text"
                    value={userProfile.grade}
                    onChange={(event) => handleProfileChange("grade", event.target.value)}
                    placeholder="VD: Lớp 5"
                    autoComplete="off"
                  />
                </div>

                <div className="nav-field">
                  <label htmlFor="profile-age">Độ tuổi</label>
                  <input
                    id="profile-age"
                    type="text"
                    value={userProfile.age}
                    onChange={(event) => handleProfileChange("age", event.target.value)}
                    placeholder="VD: 10 tuổi"
                    autoComplete="off"
                  />
                </div>

                <div className="nav-field">
                  <label htmlFor="profile-goal">Mục tiêu hiện tại</label>
                  <input
                    id="profile-goal"
                    type="text"
                    value={userProfile.goal}
                    onChange={(event) => handleProfileChange("goal", event.target.value)}
                    placeholder="Ví dụ: Hoàn thành dự án buổi 08"
                    autoComplete="off"
                  />
                </div>

                <div className="nav-field">
                  <label htmlFor="profile-topics">Chủ đề em thích</label>
                  <input
                    id="profile-topics"
                    type="text"
                    value={userProfile.favoriteTopics}
                    onChange={(event) => handleProfileChange("favoriteTopics", event.target.value)}
                    placeholder="Ví dụ: Game bắn máy bay, robot, toán"
                    autoComplete="off"
                  />
                </div>

                <div className="nav-field">
                  <label htmlFor="profile-notes">Ghi chú cho cô MindX</label>
                  <textarea
                    id="profile-notes"
                    value={userProfile.notes}
                    onChange={(event) => handleProfileChange("notes", event.target.value)}
                    rows={3}
                    placeholder="Ví dụ: Em đang chuẩn bị thi MindX Challenge."
                  />
                </div>
              </div>
            )}
          </div>
        </aside>

        <div className="chat-column">
          <div className="chat-toolbar">
            <button
              type="button"
              className="toolbar-button primary"
              onClick={handleToggleNav}
              aria-expanded={isNavOpen}
            >
              🧭 Điều hướng
            </button>
            <span className="toolbar-spacer" style={{ fontSize: "14px", color: "#64748b" }}>
              Author :  Trần Chí Bảo
            </span>
            <div className="chat-toolbar-actions">
              <button type="button" className="toolbar-button" onClick={() => setShowUploadPanel(true)}>
                <FolderUp size={16} style={{ marginRight: 8 }} /> Tải dự án Scratch
              </button>
              <button type="button" className="toolbar-button" onClick={() => setShowLegendPanel(true)}>
                <Shapes size={16} style={{ marginRight: 8 }} /> Xem khối Scratch
              </button>
              <button type="button" className="toolbar-button subtle" onClick={handleSwitchToAdmin}>
                <Gauge size={16} style={{ marginRight: 8 }} /> Dashboard
              </button>
            </div>
          </div>
          <div className="chat-wrapper">
            <MessagesList items={messages} onScroll={handleChatScroll} chatRef={chatRef} />
            {showScrollButton && (
              <button type="button" className="chat-scroll-button" onClick={() => scrollChatToBottom("smooth")}>
                <ArrowDownToLine size={16} style={{ marginRight: 8 }} /> Xuống cuối trò chuyện
              </button>
            )}
          </div>

          {/* suggestion card removed */}
        </div>
      </main>

      {!isDesktop && isNavOpen && (
        <button
          type="button"
          className="nav-backdrop"
          onClick={() => setIsNavOpen(false)}
          aria-label="Đóng điều hướng"
        />
      )}

      <footer className="composer">
        <div className="composer-area">
          <div className="composer-top-row">
            <StatusIndicator status={status} />
            <div className="inline-suggestions" role="list">
              {INLINE_SUGGESTION_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="inline-suggestion"
                  onClick={() => handleSuggestionClick(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
          <textarea
            placeholder={showProfileModal ? "Vui lòng điền thông tin học viên trước khi sử dụng chat..." : "Nhập câu hỏi cho cô MindX..."}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePasteIntoComposer}
            disabled={pending || showProfileModal}
          />

          {attachments.length > 0 && (
            <div className="composer-attachments">
              {attachments.map((item) => {
                const snippetPreview = formatAttachmentSnippet(item.snippet);
                return (
                  <div key={item.id} className="composer-attachment">
                    {item.kind === "image" && item.preview ? (
                      <img src={item.preview} alt={item.name} />
                    ) : (
                      <div className="composer-attachment-icon" aria-hidden="true">
                        <FileText size={18} />
                      </div>
                    )}
                    <div className="composer-attachment-info">
                      <span className="name">{item.name}</span>
                      <span className="meta">
                        {item.sizeLabel}
                        {snippetPreview ? ` • ${snippetPreview}` : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAttachmentRemove(item.id)}
                      aria-label={`Xóa tệp ${item.name}`}
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="composer-buttons">
          <button type="button" className="secondary" onClick={handleAttachmentButton} disabled={pending || showProfileModal}>
            <Paperclip size={16} style={{ marginRight: 8 }} /> Đính kèm
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleExportSb3}
            disabled={pending || exporting || !latestScratchContent || showProfileModal}
          >
            {exporting ? "Đang tạo .sb3..." : "Xuất .sb3"}
          </button>
          <button type="button" onClick={handleSend} disabled={pending || showProfileModal || (input.trim().length === 0 && attachments.length === 0)}>
            {pending ? "Đang xử lý..." : (<><Send size={16} style={{ marginRight: 8 }} /> Gửi</>)}
          </button>
        </div>
      </footer>

      {showUploadPanel && (
        <div
          className="overlay upload-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowUploadPanel(false);
            }
          }}
        >
          <div className="overlay-content upload-modal-content">
            <div className="overlay-card upload-modal-card">
              <div className="upload-modal-header">
                <div className="upload-modal-icon">📁</div>
                <div className="upload-modal-title-section">
                  <h2>Tải dự án Scratch</h2>
                  <p>Gửi tệp .sb3 để cô phân tích và góp ý cho em nhé.</p>
                </div>
                <button
                  type="button"
                  className="overlay-close"
                  onClick={() => setShowUploadPanel(false)}
                  aria-label="Đóng tải dự án Scratch"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="upload-modal-body">
                <button 
                  type="button" 
                  className="upload-button"
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={pending}
                >
                  <FolderUp size={20} />
                  <span>Chọn tệp .sb3</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".sb3"
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                {sb3Report && (
                  <div className="sb3-report">
                    <h3>📊 Báo cáo tóm tắt</h3>
                    <div className="sb3-summary">
                      <p><strong>Tổng quan:</strong> {sb3Report.summary.spriteCount} nhân vật</p>
                      {!!sb3Report.summary.emptySprites?.length && (
                        <p><strong>Nhân vật chưa có chương trình:</strong> {sb3Report.summary.emptySprites.join(", ")}</p>
                      )}
                    </div>
                    <button type="button" className="clear-report-button" onClick={clearSb3Report}>
                      🗑️ Xóa báo cáo
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showLegendPanel && (
        <div
          className="overlay legend-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowLegendPanel(false);
            }
          }}
        >
          <div className="overlay-content legend-modal-content">
            <div className="overlay-card legend-modal-card">
              <div className="legend-modal-header">
                <div className="legend-modal-icon">🧩</div>
                <div className="legend-modal-title-section">
                  <h2>Thông tin các khối Scratch</h2>
                  <p>Nhìn vào màu sắc để đoán nhóm lệnh. Cô dùng chip màu giống trong Scratch.</p>
                </div>
                <button
                  type="button"
                  className="overlay-close"
                  onClick={() => setShowLegendPanel(false)}
                  aria-label="Đóng thông tin khối Scratch"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="legend-modal-body">
                <ul className="legend-list">
                  {SCRATCH_LEGEND.map((item) => (
                    <li key={item.category} className="legend-item">
                      <span className={`scratch-chip ${item.className}`}>{item.example}</span>
                      <div className="legend-item-content">
                        <strong>{item.category}</strong>
                        <span className="legend-desc">{item.description}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="legend-note">
                  <div className="note-icon">💡</div>
                  <p>
                    Trong tin nhắn, cô MindX luôn ghi theo dạng <code>Category &gt; Block</code> để em nhận ra nhanh.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <div
          className="overlay profile-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-modal-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              // Không cho phép đóng modal bằng click outside
              return;
            }
          }}
        >
          <div className="overlay-content profile-modal-content">
            <div className="overlay-card profile-modal-card">
              <div className="profile-modal-header">
                <h2 id="profile-modal-title">👤 Thông tin học viên</h2>
                <p>Để sử dụng chat với cô MindX, em cần điền đầy đủ thông tin cá nhân nhé!</p>
              </div>
              
              <div className="profile-modal-form">
                <div className="form-group">
                  <label htmlFor="modal-profile-name">
                    Tên của em <span className="required">*</span>
                  </label>
                  <input
                    id="modal-profile-name"
                    type="text"
                    value={userProfile.name}
                    onChange={(event) => handleProfileChange("name", event.target.value)}
                    placeholder="Nhập tên của em"
                    autoComplete="off"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="modal-profile-grade">
                    Lớp <span className="required">*</span>
                  </label>
                  <input
                    id="modal-profile-grade"
                    type="text"
                    value={userProfile.grade}
                    onChange={(event) => handleProfileChange("grade", event.target.value)}
                    placeholder="VD: Lớp 5"
                    autoComplete="off"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="modal-profile-age">
                    Độ tuổi <span className="required">*</span>
                  </label>
                  <input
                    id="modal-profile-age"
                    type="text"
                    value={userProfile.age}
                    onChange={(event) => handleProfileChange("age", event.target.value)}
                    placeholder="VD: 10 tuổi"
                    autoComplete="off"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="modal-profile-program">Khóa học</label>
                  <select
                    id="modal-profile-program"
                    value={userProfile.program || ""}
                    onChange={(event) => handleProfileChange("program", event.target.value)}
                  >
                    <option value="SB">SB - Scratch Beginner</option>
                    <option value="SA">SA - Scratch Advanced</option>
                    <option value="SI">SI - Scratch Intensive</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="modal-profile-goal">Mục tiêu hiện tại</label>
                  <input
                    id="modal-profile-goal"
                    type="text"
                    value={userProfile.goal}
                    onChange={(event) => handleProfileChange("goal", event.target.value)}
                    placeholder="Ví dụ: Hoàn thành dự án buổi 08"
                    autoComplete="off"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="modal-profile-topics">Chủ đề em thích</label>
                  <input
                    id="modal-profile-topics"
                    type="text"
                    value={userProfile.favoriteTopics}
                    onChange={(event) => handleProfileChange("favoriteTopics", event.target.value)}
                    placeholder="Ví dụ: Game bắn máy bay, robot, toán"
                    autoComplete="off"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="modal-profile-notes">Ghi chú cho cô MindX</label>
                  <textarea
                    id="modal-profile-notes"
                    value={userProfile.notes}
                    onChange={(event) => handleProfileChange("notes", event.target.value)}
                    placeholder="Ví dụ: Em đang chuẩn bị thi MindX Challenge."
                    rows={3}
                  />
                </div>
              </div>

              <div className="profile-modal-note">
                <p><strong>Lưu ý:</strong> Các trường có dấu <span className="required">*</span> là bắt buộc. Thông tin này giúp cô MindX hiểu em hơn và đưa ra lời khuyên phù hợp.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <input
        ref={attachmentInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif,text/plain,text/markdown,application/json"
        style={{ display: "none" }}
        onChange={handleAttachmentInputChange}
      />
    </>
  );

  const serverStatusOverlay =
    serverOnline === false ? (
      <div
        className="server-status-overlay"
        role="alertdialog"
        aria-live="assertive"
        aria-busy="true"
        aria-modal="true"
      >
        <div className="server-status-card">
          <div className="server-status-spinner" aria-hidden="true" />
          <h2>Cô đang mở máy</h2>
          <p>{NETWORK_ERROR_MESSAGE}</p>
        </div>
      </div>
    ) : null;

  return (
    <div className={`app ${activeView === "admin" ? "admin-mode" : ""}`}>
      {serverStatusOverlay}
      <Routes>
        <Route
          path="/dashboard"
          element={
            <Dashboard
              isAdminAuthenticated={isAdminAuthenticated}
              adminLoginError={adminLoginError}
              adminLoginPending={adminLoginPending}
              adminUsername={adminUsername}
              adminPassword={adminPassword}
              onAdminUsernameChange={setAdminUsername}
              onAdminPasswordChange={setAdminPassword}
              onLogin={handleAdminLogin}
              onReturnToChat={handleReturnToChat}
              analyticsData={analyticsData}
              analyticsLoading={analyticsLoading}
              analyticsError={analyticsError}
              analyticsLastUpdated={analyticsLastUpdated}
              onRefresh={retrieveAnalytics}
              onLogout={handleAdminLogout}
              numberFormatter={numberFormatter}
              dateTimeFormatter={dateTimeFormatter}
              shortDateFormatter={shortDateFormatter}
              classFilter={classFilter}
              onClassFilterChange={handleClassFilterChange}
              selectedClass={selectedClass}
              onClassClick={handleClassClick}
              selectedStudent={selectedStudent}
              onStudentClick={handleStudentClick}
              studentModalOpen={studentModalOpen}
              onCloseStudentModal={handleCloseStudentModal}
              studentChatHistory={studentChatHistory}
              studentChatLoading={studentChatLoading}
            />
          }
        />
        <Route path="*" element={chatRouteElement} />
      </Routes>
    </div>
  );
}
