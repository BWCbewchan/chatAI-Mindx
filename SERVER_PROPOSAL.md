# 📊 YÊU CẦU CẤU HÌNH SERVER - MindX STEM Chat AI

**Ngày:** 27/11/2025  
**Quy mô:** 5,000 học viên (4 bộ môn)  
**Lịch học:** T2-T6 (18h-21h) + T7/CN (cả ngày)

---

## 🎯 YÊU CẦU HỆ THỐNG

- **5,000 học viên:** 1,800 online + 3,200 offline
- **15-20 lớp đồng thời** vào peak (18h-21h + T7/CN)
- **400-500 requests/phút** tại giờ cao điểm
- **40,000-50,000 conversations/ngày**
- **4 bộ môn:** Coding/Scratch, Web, Python, Computer Science

---

## ✅ CẤU HÌNH SERVER CẦN CẤP

| Thông số | Yêu cầu tối thiểu |
|----------|-------------------|
| **CPU** | **4-8 vCPU** (x86_64) |
| **RAM** | **8 GB** |
| **Storage** | **200 GB SSD** |
| **Network** | 1 Gbps, Public IP |
| **Bandwidth** | **2 TB/tháng** |
| **OS** | Ubuntu 22.04 LTS / CentOS 8 / Amazon Linux 2023 |
| **Ports** | 80 (HTTP), 443 (HTTPS), 22 (SSH) |

---

## 📦 PHẦN MỀM CẦN CÀI ĐẶT

### Runtime & Services:
```
├─ Node.js 20 LTS
├─ PM2 (Process manager)
├─ Redis 7.x (2GB RAM allocation)
├─ Nginx (Reverse proxy + SSL termination)
└─ Git, Build tools
```

### Phân bổ RAM (8GB):
```
├─ Node.js Application: 4GB (2-3 workers)
├─ Redis: 2GB (cache + session + rate limiting)
├─ Nginx: 1GB
└─ OS + System: 1GB
```

### Cấu hình Redis:
```bash
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
```

### Cấu hình PM2:
```javascript
{
  instances: 2-3,
  exec_mode: "cluster",
  max_memory_restart: "1500M",
  node_args: "--max-old-space-size=1536"
}
```

---

## 🌐 EXTERNAL SERVICES (Bắt buộc)

### 1. MongoDB Atlas
- **Tier:** M10 (Khuyến nghị) hoặc M0 Free
- **Specs:** 2GB RAM, 10GB storage
- **Region:** Singapore / Tokyo
- **Backup:** Tự động
- **Connection:** TLS/SSL required

### 2. Google Gemini API
- **Tier:** Paid (BẮT BUỘC)
- **Rate limit:** 2,000 requests/phút
- **Quota:** 420,000 calls/tuần (60K/ngày)
- **Model:** gemini-1.5-flash hoặc gemini-1.5-pro

---

---

## 📊 TỔNG KẾT YÊU CẦU

### Server có sẵn cần:
| Thông số | Yêu cầu |
|----------|---------|
| **CPU** | 4-8 vCPU |
| **RAM** | 8 GB |
| **Storage** | 200 GB SSD |
| **Network** | Public IP, 1 Gbps, 2TB/tháng |
| **OS** | Ubuntu 22.04 / CentOS 8 / Amazon Linux |
| **Ports mở** | 80, 443, 22 |

### Cần cài đặt:
- Node.js 20 LTS + PM2
- Redis 7.x
- Nginx
- Git, Build tools (gcc, make, python3)

### External services cần đăng ký:
- MongoDB Atlas (M10 hoặc M0 Free)
- Google Gemini API (Paid tier)

---

## 🏗️ KIẾN TRÚC ALL-IN-ONE

```
                Internet
                   │
                   ▼
            CloudFlare CDN (Optional)
                   │
                   ▼
        ┌──────────────────────────┐
        │   1 SERVER DUY NHẤT      │
        │    (4-8 vCPU, 8GB RAM)   │
        ├──────────────────────────┤
        │  Nginx (1GB)             │
        │         │                │
        │    ┌────┴────┐           │
        │    ▼         ▼           │
        │  Node.js × 2-3 workers   │
        │  (4GB total)             │
        │    │                     │
        │    └─ Redis (2GB)        │
        │         │                │
        │         ▼                │
        │    MongoDB Atlas         │
        │    (External)            │
        │         │                │
        │         ▼                │
        │    Gemini API            │
        │    (External)            │
        └──────────────────────────┘
        │         │                │
        │         ▼                │
        │    Gemini API            │
        │    (External)            │
        └──────────────────────────┘
```

---

## 🎯 PLATFORM KHUYẾN NGHỊ

### Option 1: AWS EC2
- **Instance:** t3.large (2 vCPU, 8GB RAM) - Budget
- **Hoặc:** c6i.xlarge (4 vCPU, 8GB RAM) - Performance
- **Storage:** 200GB gp3 SSD
- **Network:** Up to 5 Gbps

### Option 2: Google Cloud
- **Instance:** e2-standard-4 (4 vCPU, 8GB RAM)
- **Hoặc:** n2-standard-2 (2 vCPU, 8GB RAM)
- **Storage:** 200GB Balanced SSD
- **Network:** Standard tier

### Option 3: DigitalOcean (Khuyến nghị - Budget)
- **Droplet:** Premium 8GB ($48/tháng)
- **CPU:** 4 vCPU dedicated
- **Storage:** 160GB NVMe SSD
- **Bandwidth:** 5TB included

---

## 📋 CHECKLIST SETUP

### ✅ Server có sẵn - Cần kiểm tra:
- [ ] CPU: 4-8 vCPU
- [ ] RAM: 8 GB
- [ ] Storage: 200 GB SSD (trống ≥150GB)
- [ ] Public IP
- [ ] Ports 80, 443, 22 đã mở
- [ ] Bandwidth: 2TB/tháng

### ✅ Cần cài đặt trên server:
- [ ] Ubuntu 22.04 LTS (hoặc OS tương tự)
- [ ] Node.js 20 LTS
- [ ] PM2 (process manager)
- [ ] Redis 7.x
- [ ] Nginx
- [ ] SSL Certificate (Let's Encrypt)
- [ ] Git, build-essential

### ✅ External services cần đăng ký:
- [ ] MongoDB Atlas account (M10 tier, Singapore region)
- [ ] Google Cloud account (Gemini API Paid tier)
- [ ] Domain name (nếu chưa có)
- [ ] CloudFlare (CDN - optional)

---

## 📞 LIÊN HỆ

**Technical Team**  
Email: tech@mindx.edu.vn

---

## ✅ TÓM TẮT

**Server có sẵn cần đảm bảo:**
- ✅ **4-8 vCPU, 8GB RAM, 200GB SSD**
- ✅ **Public IP, ports 80/443/22**
- ✅ **2TB bandwidth/tháng**

**Phần mềm cài thêm:**
- ✅ Node.js 20 + PM2 + Redis + Nginx

**External services:**
- ✅ MongoDB Atlas M10 (Singapore)
- ✅ Gemini API Paid tier

**Khả năng:** 15-20 lớp đồng thời, 40K-50K conversations/ngày
