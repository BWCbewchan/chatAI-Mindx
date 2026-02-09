# MindX STEM Chat

Ứng dụng web hỗ trợ học sinh trao đổi với giáo viên STEM ảo, được huấn luyện dựa trên bộ giáo án MindX và tích hợp Gemini API. Học sinh có thể:

- Đặt câu hỏi về nội dung các buổi học trong giáo án kèm gợi ý hoạt động thực hành.
- Tải lên tệp dự án Scratch (`.sb3`) để nhận phân tích tự động và phản hồi cá nhân hóa.

## 🎯 Tại sao không dùng ChatGPT?

### 1️⃣ **Giáo án MindX luôn trong tầm tay**
- ✅ **Ứng dụng này**: Tự động tìm và trích dẫn chính xác nội dung từ giáo án MindX của bạn. Mỗi câu trả lời đều kèm nguồn tham chiếu (ví dụ: "Buổi 04 - Trang 3").
- ❌ **ChatGPT**: Không biết gì về giáo án MindX. Bạn phải copy-paste nội dung giáo án vào mỗi lần hỏi, hoặc upload file (nhưng ChatGPT có thể "quên" sau vài câu).

### 2️⃣ **Phân tích dự án Scratch chuyên sâu**
- ✅ **Ứng dụng này**: Upload file `.sb3` → nhận báo cáo chi tiết:
  - Học sinh dùng bao nhiêu sprite, khối lệnh nào
  - Thiếu biến hay broadcast nào chưa
  - Gợi ý cụ thể để cải thiện dự án
- ❌ **ChatGPT**: Không đọc được file `.sb3`. Học sinh phải chụp ảnh hoặc gõ lại từng khối lệnh → mất thời gian và dễ sai sót.

### 3️⃣ **Giao diện thiết kế riêng cho học Scratch**
- ✅ **Ứng dụng này**: 
  - Mỗi khối lệnh hiển thị **đúng màu** của Scratch (Events màu vàng, Motion màu xanh...)
  - Hướng dẫn "**kéo khối này → nối khối kia**" rõ ràng từng bước
- ❌ **ChatGPT**: Chỉ hiển thị text đen trắng, không phân biệt màu khối. Học sinh khó hình dung.

### 4️⃣ **Lưu trữ lịch sử riêng tư và miễn phí**
- ✅ **Ứng dụng này**: 
  - Dữ liệu lưu **trên máy bạn**, không ai xem được
  - Tạo nhiều cuộc trò chuyện, chuyển đổi dễ dàng
  - Hoàn toàn **miễn phí** (chỉ cần API key Gemini free)
- ❌ **ChatGPT**: 
  - Lịch sử chat lưu trên máy chủ OpenAI
  - GPT-4 tốt nhất nhưng tốn phí ($20/tháng)

### 5️⃣ **Hiểu "tiếng nói" học sinh MindX**
- ✅ **Ứng dụng này**: AI được "huấn luyện" với:
  - Cách gọi tên khối lệnh đúng chuẩn Scratch (Events > When Green Flag Clicked)
  - Ngữ cảnh giáo án MindX (Buổi 04, Buổi 07...)
  - Giọng điệu thân thiện với học sinh cấp 1-2
- ❌ **ChatGPT**: Trả lời chung chung, đôi khi dùng từ quá khó hoặc không đúng thuật ngữ Scratch.

### 6️⃣ **Tùy biến 100% theo nhu cầu MindX**
- ✅ **Ứng dụng này**: 
  - Muốn thêm tính năng gì? → Dev có thể code thêm
  - Thay đổi giao diện, logo, màu sắc theo thương hiệu
  - Tích hợp với hệ thống quản lý học sinh nếu cần
- ❌ **ChatGPT**: Chỉ dùng được những gì OpenAI cho phép.

### 7️⃣ **Chi phí rẻ hơn nhiều**
- ✅ **Ứng dụng này**: 
  - Gemini API: **miễn phí** đến 1500 request/ngày (đủ cho cả lớp)
  - Nếu trả phí: ~$0.35/1 triệu từ (rẻ gấp 10 lần GPT-4)
- ❌ **ChatGPT**: 
  - GPT-4: $20/người/tháng hoặc $0.03/1000 từ (API)

---

### 📊 Bảng so sánh nhanh

| Tiêu chí | MindX STEM Chat | ChatGPT |
|----------|-----------------|---------|
| **Hiểu giáo án MindX** | ✅ Tự động tìm & trích dẫn | ❌ Không biết, phải copy-paste |
| **Phân tích file .sb3** | ✅ Chi tiết từng khối | ❌ Không đọc được |
| **Hiển thị màu Scratch** | ✅ Đúng màu từng category | ❌ Text đen trắng |
| **Lưu trữ riêng tư** | ✅ Trên máy bạn | ⚠️ Trên máy chủ OpenAI |
| **Chi phí** | ✅ Miễn phí (hoặc rất rẻ) | ❌ $20/tháng (GPT-4) |
| **Tùy biến** | ✅ 100% | ❌ Bị giới hạn |

---

**💡 Kết luận**: Nếu chỉ cần hỏi đáp chung → ChatGPT đủ dùng. Nhưng nếu muốn công cụ **chuyên biệt cho giảng dạy Scratch theo giáo án MindX**, ứng dụng này vượt trội hoàn toàn!

## ✨ Tính năng chính

### 🎓 **Cho Học Sinh**
- **💬 Hỏi đáp thông minh**: Hỏi bất kỳ câu nào về bài học → AI tự động tìm thông tin từ giáo án và trả lời chi tiết.
- **📎 Gửi hình ảnh & file**: Đính kèm ảnh màn hình Scratch (tối đa 3 file) để cô AI xem và góp ý.
- **🎮 Upload dự án Scratch**: Tải file `.sb3` lên → nhận báo cáo:
  - Đã làm tốt điểm nào
  - Cần sửa chỗ nào
  - Bài tập luyện thêm
- **💾 Lưu nhiều cuộc trò chuyện**: Mỗi buổi học tạo 1 cuộc trò chuyện riêng, dễ tìm lại sau.
- **👤 Hồ sơ cá nhân**: Điền tên, lớp, mục tiêu → AI gọi tên và hỗ trợ phù hợp hơn.

### 👨‍🏫 **Cho Giáo Viên / Quản Lý**
- **📊 Bảng điều khiển**: Xem có bao nhiêu học sinh đã hỏi, câu hỏi phổ biến nhất.
- **🔍 Lọc theo lớp & ngày**: Tìm nhanh lịch sử chat của học sinh cụ thể.
- **📈 Thống kê chi tiết**: Số lượng file Scratch được upload, mức độ tương tác.


## 💡 Ví dụ Sử Dụng Thực Tế

### **Tình huống 1: Học sinh quên bài**
**Học sinh hỏi**: _"Cô ơi, buổi 07 em phải làm gì vậy ạ?"_

**AI trả lời**: 
```
## 👋 Chào em!

### 🎯 Mục tiêu buổi 07
Buổi này em sẽ học cách tạo **hiệu ứng chuyển cảnh** trong Scratch nhé!

### 🛠️ Bước làm Scratch
1. Kéo khối `Events > When Green Flag Clicked`
2. Kéo khối `Looks > Switch Backdrop to [Backdrop1]`
3. Kéo khối `Control > Wait 2 Seconds`
4. Kéo khối `Looks > Switch Backdrop to [Backdrop2]`

Chuỗi lệnh: Events > When Green Flag Clicked → Looks > Switch Backdrop to [Backdrop1] → Control > Wait 2 Seconds → Looks > Switch Backdrop to [Backdrop2]

### 📚 Nguồn tham chiếu
- Buổi 07 - Chuyển cảnh động (Độ liên quan: 94.2%)
```

---

### **Tình huống 2: Dự án không chạy đúng**
**Học sinh upload file `.sb3`** với lỗi: sprite không di chuyển

**AI phân tích**:
```
## 🔍 Phân tích dự án của em

### 🎯 Điểm đã làm tốt
- Em đã dùng đúng khối `Events > When Green Flag Clicked` để khởi động ✅
- Có thêm âm thanh rất sinh động! 🎵

### 🛠️ Cần chỉnh sửa
- **Sprite "Cat" chưa có khối Motion**: Em nhớ kéo khối `Motion > Move 10 Steps` vào nhé!
- **Thiếu vòng lặp**: Nếu muốn mèo di chuyển mãi → thêm khối `Control > Forever`

### 🎒 Bài tập luyện thêm
Thử làm mèo di chuyển qua lại bằng cách thêm:
- `Motion > If On Edge, Bounce`

### ❓ Hỏi lại cô
Em muốn mèo di chuyển theo hướng nào? Ngang hay dọc?
```

## ❓ Câu Hỏi Thường Gặp (FAQ)

### **1. Tôi không biết kỹ thuật, có dùng được không?**
Có! Giáo viên và học sinh chỉ cần mở trình duyệt và dùng như ChatGPT. Phần thiết lập ban đầu IT sẽ hỗ trợ.

### **2. Gemini API key lấy ở đâu? Có mất tiền không?**
- Vào [Google AI Studio](https://aistudio.google.com/app/apikey) → Đăng nhập Gmail → Tạo API key miễn phí
- **Miễn phí**: 1500 request/ngày (đủ cho cả lớp 30 học sinh)
- **Trả phí** (nếu cần thêm): ~20,000 VNĐ/1 triệu từ

### **3. So với ChatGPT, ứng dụng này có gì hay hơn?**
Xem phần **"Tại sao không dùng ChatGPT?"** ở trên. Tóm tắt:
- ✅ Hiểu giáo án MindX
- ✅ Đọc file `.sb3` chi tiết
- ✅ Rẻ hơn (hoặc miễn phí)
- ✅ Tùy biến được

### **4. Học sinh có thể hỏi bậy bạ không?**
AI được "huấn luyện" chỉ trả lời về Scratch và STEM. Câu hỏi không liên quan → AI sẽ nhắc nhở học sinh quay lại chủ đề học tập.

### **5. Dữ liệu học sinh có bị lộ không?**
- Lịch sử chat lưu **trên máy học sinh** (LocalStorage trình duyệt)
- Nếu dùng MongoDB (tùy chọn) → lưu trên server của bạn, không gửi cho bên thứ 3
- Gemini API chỉ nhận câu hỏi để trả lời, không lưu trữ lâu dài

### **6. Có thể dùng cho nhiều lớp không?**
Có! Mỗi giáo viên/lớp có thể:
- Tạo session riêng
- Xem dashboard riêng (cần đăng nhập admin)
- Dùng chung 1 máy chủ hoặc tách riêng

### **7. Nếu AI trả lời sai thì sao?**
- Mỗi câu trả lời có **nguồn tham chiếu** từ giáo án → giáo viên kiểm tra được
- Có thể chỉnh sửa system prompt để AI trả lời chính xác hơn
- Học sinh có thể hỏi lại: "Cô chắc chắn chưa? Kiểm tra lại giúp em"

### **8. Cần máy tính mạnh không?**
Không cần! Học sinh chỉ cần máy tính/tablet có trình duyệt web là dùng được. Không cần cài đặt gì thêm.

---

💬 **Liên hệ hỗ trợ kỹ thuật**: Nếu trường/trung tâm muốn triển khai, vui lòng liên hệ IT để được hướng dẫn setup ban đầu.

Chúc bạn và học sinh có những buổi học STEM thú vị! ✨
