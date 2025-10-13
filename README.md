# MindX STEM Chat

Ứng dụng web hỗ trợ học sinh trao đổi với giáo viên STEM ảo, được huấn luyện dựa trên bộ giáo án MindX và tích hợp Gemini API. Học sinh có thể:

- Đặt câu hỏi về nội dung các buổi học trong giáo án kèm gợi ý hoạt động thực hành.
- Tải lên tệp dự án Scratch (`.sb3`) để nhận phân tích tự động và phản hồi cá nhân hóa.

## Cấu trúc dự án

```
appchat/
├── client/          # Giao diện React (Vite)
├── server/          # API Express kết nối Gemini
├── 01. [Coding - SB] Teaching Guide/  # Bộ giáo án tham chiếu (DOCX)
├── .env             # Cấu hình khóa Gemini (không commit)
└── README.md
```

## Chuẩn bị môi trường

1. Cài đặt Node.js >= 18.
2. Trong file `.env` ở thư mục gốc, khai báo khóa API:

```ini
GEMINI_API_KEY=<YOUR_KEY>
```

(Optional) cấu hình thêm:

```ini
PORT=5001
GEMINI_MODEL=gemini-1.5-pro
MAX_UPLOAD_MB=10
TEACHING_GUIDE_DIR=../01. [Coding - SB] Teaching Guide
```

## Cài đặt & chạy

Tại thư mục gốc dự án:

```bash
cd server
npm install
npm run dev
```

Mở terminal mới:

```bash
cd ..\client
npm install
npm run dev
```

- Backend chạy tại `http://localhost:5001`.
- Frontend chạy tại `http://localhost:5173` (proxy tới API).

### Build production

```bash
cd client
npm run build
cd ..\server
npm run start
```

Express sẽ phục vụ static build từ `client/dist`.

## Tính năng chính

- **RAG đơn giản từ giáo án**: Server đọc toàn bộ `.docx`, chia đoạn, tìm kiếm tương đồng để cung cấp ngữ cảnh cho Gemini.
- **Persona giáo viên**: Gemini nhận system prompt mô tả giáo viên STEM 5 năm kinh nghiệm.
- **Phân tích Scratch**: Upload `.sb3` -> bóc tách `project.json`, thống kê sprite, khối lệnh, biến, broadcast… và sinh phản hồi từ Gemini.
- **Giao diện thân thiện**: Chat realtime, hiển thị nguồn tham chiếu, lưu trạng thái báo cáo Scratch.

## Kiểm thử nhanh

- API health check: `GET /api/health`.
- Chat demo: nhập câu hỏi “Cô nhắc lại hoạt động buổi 04 giúp em?”
- Upload dự án thử (đặt file `.sb3`).

## Gợi ý phát triển tiếp

- Lưu lịch sử hội thoại cho từng học sinh.
- Dựng bộ nhớ vector bằng embeddings thay cho string similarity.
- Bổ sung xác thực người dùng.

Chúc bạn và học sinh có những buổi học STEM thú vị! ✨
