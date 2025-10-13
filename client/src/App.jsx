import { Children, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import remarkGfm from "remark-gfm";
import {
  exportSb3FromChat,
  fetchAdminAnalytics,
  loginAdmin,
  logoutAdmin,
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

### ❓Hỏi lại cô
- "Cô ơi, em nên bắt đầu từ buổi nào?"
- "Dự án của em đang lỗi phần chuyển cảnh, cô giúp em với ạ?"`,
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

const DEFAULT_SUGGESTION_PROMPTS = [
  "Cô nhắc lại phần hoạt động của buổi 04 giúp em với?",
  "Em nên sửa phần chuyển cảnh trong buổi 07 như thế nào?",
  "Cô tạo giúp em file .sb3 với chuỗi lệnh vừa hướng dẫn nhé?"
];

const DEFAULT_SUGGESTION_SECTION = {
  title: "❓Hỏi lại cô",
  suggestions: DEFAULT_SUGGESTION_PROMPTS
};

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

function extractSuggestionsFromContent(content) {
  if (typeof content !== "string" || !content) {
    return null;
  }

  const lines = content.split(/\n/);
  let headingTitle = null;
  let headingIndex = -1;
  const keywordChecks = ["goi y hoi co", "hoi lai co"];

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index]?.trim();
    if (!trimmed) {
      continue;
    }

    const withoutMarkers = trimmed
      .replace(/^#{1,6}\s*/, "")
      .replace(/^[>*\s]+/, "")
      .replace(/^[*_`]+|[*_`]+$/g, "")
      .trim();

    const normalized = normalizeForComparison(withoutMarkers);

    if (!keywordChecks.some((keyword) => normalized.includes(keyword))) {
      continue;
    }

    headingTitle = withoutMarkers.replace(/:+\s*$/, "");
    headingIndex = index;
    break;
  }

  if (headingIndex === -1 || !headingTitle) {
    return null;
  }

  const suggestions = [];

  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const rawLine = lines[index];
    if (typeof rawLine !== "string") continue;
    const trimmed = rawLine.trim();

    if (!trimmed) {
      continue;
    }

    const normalizedLine = normalizeForComparison(trimmed.replace(/^[>*\s]+/, ""));

    if (/^#{1,6}\s/.test(trimmed) || keywordChecks.some((keyword) => normalizedLine.includes(keyword))) {
      break;
    }

    const cleaned = trimmed
      .replace(/^[-*•+\d.)\s>]+/, "")
      .replace(/^["“”']+|["“”']+$/g, "")
      .trim();

    if (cleaned.length === 0 || cleaned.length > 160) {
      continue;
    }

    suggestions.push(cleaned);
  }

  if (!suggestions.length) {
    return null;
  }

  return { title: headingTitle, suggestions };
}

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

  const matched = /([^>]+)>(.+)/.exec(cleaned);
  if (!matched) return null;

  const categoryRaw = matched[1];
  const blockName = matched[2].trim();
  const normalizedKey = normalizeCategoryName(categoryRaw);
  const mappedClass = SCRATCH_CATEGORY_MAP[normalizedKey] || SCRATCH_CATEGORY_MAP[categoryRaw.trim().toLowerCase()];

  if (!mappedClass) {
    return null;
  }

  return {
    className: mappedClass,
    category: categoryRaw.trim(),
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

  const rows = [];

  for (const line of lines) {
    const stripped = line
      .replace(/^[-*•\u2022➤\d.)\s]+/, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!stripped) {
      continue;
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
      return null;
    }

    const chips = [];

    for (const segment of segments) {
      const info = getScratchCategoryClass(segment);
      if (!info) {
        return null;
      }
      chips.push(info);
    }

    rows.push(chips);
  }

  return rows.length ? rows : null;
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
          {scratchStack.map((row, rowIndex) => (
            <div className="scratch-stack-row" key={`scratch-row-${rowIndex}`}>
              {row.map((chip, chipIndex) => (
                <Fragment key={`scratch-chip-${rowIndex}-${chipIndex}-${chip.block}`}>
                  <span className={`scratch-chip ${chip.className}`}>
                    <span className="scratch-chip-category">{chip.category}</span>
                    <span className="scratch-chip-arrow" aria-hidden="true">
                      ›
                    </span>
                    <span className="scratch-chip-block">{chip.block}</span>
                  </span>
                  {chipIndex < row.length - 1 && (
                    <span className="scratch-stack-arrow" aria-hidden="true">
                      →
                    </span>
                  )}
                </Fragment>
              ))}
            </div>
          ))}
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

function MessageBubble({ message }) {
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
}

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
  const [sb3Report, setSb3Report] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const chatRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [showLegendPanel, setShowLegendPanel] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
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
      return;
    }

    if (adminToken) {
      window.sessionStorage.setItem("mindx-admin-token", adminToken);
    } else {
      window.sessionStorage.removeItem("mindx-admin-token");
    }
  }, [adminToken]);

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
    async (tokenOverride) => {
      const effectiveToken = tokenOverride ?? adminToken;
      if (!effectiveToken) {
        return;
      }

      setAnalyticsLoading(true);
      setAnalyticsError(null);

      try {
        const data = await fetchAdminAnalytics(effectiveToken);
        setAnalyticsData(data);
        setAnalyticsLastUpdated(Date.now());
      } catch (error) {
        if (error.status === 401 || error.status === 403) {
          setAdminToken(null);
          setAnalyticsData(null);
          setAnalyticsError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        } else {
          setAnalyticsError(error.message || "Không thể tải dữ liệu thống kê.");
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

        if (result?.token) {
          setAdminToken(result.token);
          navigate("/dashboard");
          setAdminPassword("");
          await retrieveAnalytics(result.token);
        } else {
          setAdminLoginError("Máy chủ không trả về mã đăng nhập.");
        }
      } catch (error) {
        setAdminLoginError(error.message || "Không thể đăng nhập quản trị.");
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
  }, [navigate]);

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
    if ((messageContent.length === 0 && attachments.length === 0) || pending) return;

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
      setError(err.message);
      setMessages(nextMessages.slice(0, nextMessages.length));
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
      setError(err.message);
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
    setShowSuggestions(true);
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
      setShowSuggestions(true);
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
          setShowSuggestions(true);
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
          setShowSuggestions(true);
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
    setUserProfile((prev) => ({
      ...prev,
      [field]: value
    }));
  }, []);

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

  const dynamicSuggestionSection = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role !== "assistant") {
        continue;
      }

      const section = extractSuggestionsFromContent(message.content);
      if (section?.suggestions?.length) {
        return {
          title: section.title || DEFAULT_SUGGESTION_SECTION.title,
          suggestions: section.suggestions.slice(0, 6)
        };
      }
    }
    return null;
  }, [messages]);

  const { title: suggestionTitle, suggestions: suggestionPrompts } =
    dynamicSuggestionSection ?? DEFAULT_SUGGESTION_SECTION;

  const status = useMemo(() => {
    if (exporting) {
      return { type: "exporting", label: "🛠️ Cô đang tạo file .sb3 cho em..." };
    }
    if (pending) {
      return { type: "thinking", label: "🤔 Cô MindX đang suy nghĩ câu trả lời hay nhất..." };
    }
    if (input.trim().length > 0) {
      return { type: "typing", label: "✍️ Em đang gõ tin nhắn. Cứ thoải mái viết nhé!" };
    }
    return { type: "idle", label: "🌟 Cô luôn sẵn sàng lắng nghe." };
  }, [exporting, pending, input]);

  const handleExportSb3 = async () => {
    if (!latestScratchContent || exporting) {
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const blob = await exportSb3FromChat(latestScratchContent);
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
      setError(err.message || "Không thể xuất file .sb3");
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
            <button
              type="button"
              className="nav-dashboard"
              onClick={handleSwitchToAdmin}
            >
              🛠️ Dashboard
            </button>
            <button
              type="button"
              className="nav-close"
              onClick={handleToggleNav}
              aria-label={isDesktop ? "Thu gọn điều hướng" : "Đóng điều hướng"}
            >
              {isDesktop ? "<" : "×"}
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
                          ✏️
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
                          🗑️
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
                  <label htmlFor="profile-grade">Lớp / độ tuổi</label>
                  <input
                    id="profile-grade"
                    type="text"
                    value={userProfile.grade}
                    onChange={(event) => handleProfileChange("grade", event.target.value)}
                    placeholder="VD: Lớp 5 / 10 tuổi"
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
                📁 Tải dự án Scratch
              </button>
              <button type="button" className="toolbar-button" onClick={() => setShowLegendPanel(true)}>
                🎨 Xem khối Scratch
              </button>
              <button type="button" className="toolbar-button subtle" onClick={handleSwitchToAdmin}>
                🛠️ Dashboard
              </button>
            </div>
          </div>
          <div className="chat-wrapper">
            <section className="chat" ref={chatRef} onScroll={handleChatScroll}>
              {messages.map((message, index) => (
                <MessageBubble key={index} message={message} />
              ))}
            </section>
            {showScrollButton && (
              <button
                type="button"
                className="chat-scroll-button"
                onClick={() => scrollChatToBottom("smooth")}
              >
                📥 Xuống cuối trò chuyện
              </button>
            )}
          </div>

          <div className={`card suggestion-card ${showSuggestions ? "open" : "collapsed"}`}>
            <div className="suggestion-card-header">
              <h2>{suggestionTitle}</h2>
              <button
                type="button"
                className="suggestion-toggle"
                onClick={() => setShowSuggestions((prev) => !prev)}
                aria-expanded={showSuggestions}
              >
                {showSuggestions ? "Thu gọn" : "Mở ra"}
                <span aria-hidden="true">{showSuggestions ? "▴" : "▾"}</span>
              </button>
            </div>
            {showSuggestions && (
              <>
                <p>Chọn nhanh một câu phía dưới để hỏi lại cô MindX nhé.</p>
                <div className="suggestion-buttons">
                  {suggestionPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="suggestion-button"
                      onClick={() => handleSuggestionClick(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
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
          <StatusIndicator status={status} />
          <textarea
            placeholder="Nhập câu hỏi cho cô MindX..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePasteIntoComposer}
            disabled={pending}
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
                        📄
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
                      ×
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
          <button type="button" className="secondary" onClick={handleAttachmentButton} disabled={pending}>
            Đính kèm
          </button>
          <button
            type="button"
            className="secondary"
            onClick={handleExportSb3}
            disabled={pending || exporting || !latestScratchContent}
          >
            {exporting ? "Đang tạo .sb3..." : "Xuất .sb3"}
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={pending || (input.trim().length === 0 && attachments.length === 0)}
          >
            {pending ? "Đang xử lý..." : "Gửi"}
          </button>
        </div>
      </footer>

      {showUploadPanel && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowUploadPanel(false);
            }
          }}
        >
          <div className="overlay-content">
            <button
              type="button"
              className="overlay-close"
              onClick={() => setShowUploadPanel(false)}
              aria-label="Đóng tải dự án Scratch"
            >
              ×
            </button>
            <div className="overlay-card">
              <h2>Tải dự án Scratch</h2>
              <p>Gửi tệp .sb3 để cô phân tích và góp ý cho em nhé.</p>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={pending}>
                Chọn tệp .sb3
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
                  <h3>Báo cáo tóm tắt</h3>
                  <p>Tổng quan: {sb3Report.summary.spriteCount} nhân vật.</p>
                  {!!sb3Report.summary.emptySprites?.length && (
                    <p>Nhân vật chưa có chương trình: {sb3Report.summary.emptySprites.join(", ")}</p>
                  )}
                  <button type="button" className="link" onClick={clearSb3Report}>
                    Xóa báo cáo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showLegendPanel && (
        <div
          className="overlay"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowLegendPanel(false);
            }
          }}
        >
          <div className="overlay-content">
            <button
              type="button"
              className="overlay-close"
              onClick={() => setShowLegendPanel(false)}
              aria-label="Đóng thông tin khối Scratch"
            >
              ×
            </button>
            <div className="overlay-card">
              <h2>Thông tin các khối Scratch</h2>
              <p>Nhìn vào màu sắc để đoán nhóm lệnh. Cô dùng chip màu giống trong Scratch.</p>
              <ul className="legend-list">
                {SCRATCH_LEGEND.map((item) => (
                  <li key={item.category} className="legend-item">
                    <span className={`scratch-chip ${item.className}`}>{item.example}</span>
                    <strong>{item.category}</strong>
                    <span className="legend-desc">{item.description}</span>
                  </li>
                ))}
              </ul>
              <p className="legend-note">
                Trong tin nhắn, cô MindX luôn ghi theo dạng <code>Category &gt; Block</code> để em nhận ra nhanh.
              </p>
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

  return (
    <div className={`app ${activeView === "admin" ? "admin-mode" : ""}`}>
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
            />
          }
        />
        <Route path="*" element={chatRouteElement} />
      </Routes>
    </div>
  );
}
