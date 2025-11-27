# 📊 Yêu Cầu Cấu Hình Server - MindX STEM Chat Application

**Ngày báo cáo:** 27/11/2025  
**Dự án:** MindX STEM Chat (chatAI-Mindx)  
**Người thực hiện:** Technical Team  
**Mục đích:** Đề xuất cấu hình server phù hợp dựa trên phân tích kiến trúc ứng dụng

---

## 1. 🎯 Tóm Tắt Executive Summary

MindX STEM Chat là nền tảng chat AI hỗ trợ học sinh tương tác với giáo viên ảo, phục vụ **5,000+ học viên** trên nhiều bộ môn (Scratch/Coding, Web Development, Python, Computer Science).

### 📊 Quy Mô Hiện Tại:
- **Tổng học viên:** 5,000+
- **Online:** 1,500-2,000 (30-40%) - T2-T6: 18h-21h, T7-CN: cả ngày
- **Offline:** 3,000-3,500 (60-70%)
- **Bộ môn:** 4 (Coding/Scratch, Web, Python, CS)
- **Peak:** 650-950 concurrent (18h-21h + T7/CN)

### ⚡ CHỌN SERVER NÀO? (Khuyến Nghị)

**Lịch học:** T2-T6 (18h-21h) + T7/CN (cả ngày) → Peak load tập trung buổi tối + cuối tuần

| Platform | Cấu hình | Chi phí/tháng (ước tính) | Đánh giá |
|----------|----------|--------------------------|----------|
| **AWS** ⭐ | 3-4 × c6i.2xlarge + RDS + ElastiCache | $800-1,200 | **Khuyến nghị** - Ổn định, auto-scale tốt |
| **Google Cloud** | 3-4 × c3-standard-8 + MongoDB Atlas + Memorystore | $750-1,100 | Tốt - Gemini API cùng ecosystem |
| **Azure** | 3-4 × F8s v2 + Cosmos DB + Redis Cache | $900-1,300 | Tốt - Tích hợp Microsoft |
| **DigitalOcean** | 3-4 Droplets ($96/mo) + Managed MongoDB | $500-800 | Budget - Đơn giản, dễ quản lý |

### 🎯 Cấu Hình Chi Tiết:

| Thành phần | Cấu hình | Lý do |
|-----------|----------|-------|
| **App Servers** | 3-4 × (8 vCPU, 16GB RAM) | Peak 18h-21h + T7/CN cần ~650-950 req/min |
| **Database** | MongoDB 50-100GB (3 nodes) | Replica set cho HA, auto-failover <30s |
| **Cache** | Redis 8-16GB (Cluster) | Session, rate limit, cache responses |
| **Storage** | 200-500GB SSD/instance | Logs + uploads + backup |
| **Bandwidth** | 3-5 TB/tháng | 5,000 users × 600-1000MB/user |
| **CDN** | CloudFlare/AWS CloudFront | Cache static assets, giảm tải server |

---

## 2. 📐 Kiến Trúc Ứng Dụng

### 2.1 Tech Stack

```
┌─────────────────────────────────────────────────┐
│              FRONTEND (Client)                   │
│  - React 18.3 + Vite 5.4                        │
│  - React Router, Recharts (Charts)              │
│  - Static Build → CDN-ready                     │
└─────────────────┬───────────────────────────────┘
                  │ HTTP/REST API
┌─────────────────▼───────────────────────────────┐
│              BACKEND (Server)                    │
│  - Node.js + Express 4.19                       │
│  - Google Gemini AI API Integration             │
│  - Multer (File Upload - max 4MB)               │
│  - MongoDB 6.8 (Analytics - Optional)           │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
┌──────────────┐    ┌──────────────┐
│  Gemini API  │    │   MongoDB    │
│  (External)  │    │  (Optional)  │
└──────────────┘    └──────────────┘
```

### 2.2 Đặc Điểm Kỹ Thuật (5,000 học viên)

**🟢 Yếu tố giảm tải:**

| Đặc điểm | Ảnh hưởng | Giải thích |
|----------|-----------|------------|
| **Stateless API** | ⬇️ -40% RAM | Không lưu session, mỗi request độc lập |
| **Gemini API xử lý AI** | ⬇️ -90% CPU | Server chỉ forward request |
| **Request size limit** | ⬇️ -60% Network | JSON 2MB, File 4MB × 4 files max |
| **History truncation** | ⬇️ -70% Memory | Chỉ giữ 10 message gần nhất |
| **Context chunking** | ⬇️ -50% Processing | Chỉ lấy 4 chunks liên quan |
| **Redis caching** | ⬇️ -60% Database load | Cache responses, sessions |

**🔴 Yếu tố tăng tải:**

| Đặc điểm | Ảnh hưởng | Giải thích |
|----------|-----------|------------|
| **Multi-subject support** | ⬆️ +40% Storage | 4+ bộ môn × teaching guides |
| **File processing** | ⬆️ +25% CPU | .sb3, .html, .css, .js, .py files |
| **String similarity** | ⬆️ +15% CPU | RAG context retrieval across subjects |
| **Real-time analytics** | ⬆️ +15% I/O | Dashboard cho 5000 users |
| **Concurrent sessions** | ⬆️ +50% Network | 300-500 concurrent users |

### 2.3 Yêu Cầu Đa Bộ Môn

| Bộ môn | File types | Context size | Special requirements |
|--------|-----------|--------------|---------------------|
| **Coding (Scratch)** | .sb3, .json | 50-100MB | JSZip, sprite analysis |
| **Web Development** | .html, .css, .js | 20-40MB | Code validation, preview |
| **Python** | .py, .ipynb | 10-30MB | Syntax checking, execution context |
| **Computer Science** | .pdf, .docx, .txt | 30-60MB | Theory + practice materials |

**Tổng storage cho teaching materials:** ~200GB
**Cache requirement:** 8-16GB Redis cho common responses

---

## 3. 📊 Phân Tích Tải Hệ Thống

### 3.1 Đặc Điểm Học Online vs Offline (Quy mô 5,000)

| Đặc điểm | Học Online (1,500-2,000) | Học Offline (3,000-3,500) | Ảnh hưởng Server |
|----------|--------------------------|---------------------------|------------------|
| **Thời gian sử dụng** | Đồng thời trong lớp | Phân tán cả ngày | Online cao hơn 4-6x |
| **Số lớp/ngày** | 20-30 lớp online | N/A | Concurrent spike |
| **Tần suất chat** | 8-12 tin/học sinh/buổi | 3-6 tin/học sinh/ngày | Online intensive |
| **Upload file** | 200-300 files/buổi | 400-600 files/ngày | Need queue system |
| **Concurrent users** | 300-500 peak | 50-100 baseline | 5-10x difference |
| **Peak time** | 18h-21h (3h) | Phân tán 8h-22h (14h) | Critical period |
| **Bộ môn mix** | 4 môn × 5-8 lớp/môn | All subjects mixed | Multi-tenant routing |

### 3.2 Scenarios Thực Tế

#### Scenario A: Cao điểm - Lớp Online (18h-21h) - QUY MÔ 5,000
```
Thực tế:
- Tổng học viên: 5,000 người
- Học online: 1,500-2,000 người (30-40%)
- Học offline: 3,000-3,500 người (60-70%)

Giờ học online (18h-21h) - CRITICAL PERIOD:
- 20-30 lớp online đồng thời (4 bộ môn)
  * Coding/Scratch: 8-10 lớp × 30 học sinh = 240-300
  * Web Development: 5-7 lớp × 25 học sinh = 125-175
  * Python: 4-6 lớp × 30 học sinh = 120-180
  * Computer Science: 3-5 lớp × 25 học sinh = 75-125
- Total active students: 560-780 học sinh
- Tỷ lệ chat actively: 60-70% = 336-546 người
- Requests/phút: 500-800 (PEAK)

Tải server (3-4 instances):
- CPU per instance: 60-75%
- RAM per instance: 10-12GB
- Total Network: 20-35 Mbps
- Disk I/O: Moderate (logs + analytics)
- Gemini API: 500-800 calls/phút
- Redis cache hits: 40-50% (giảm API load)
- Database connections: 150-200 concurrent
```

#### Scenario B: Giờ làm bài - Lớp Offline (8h-22h) - QUY MÔ 5,000
```
Thực tế:
- Học offline: 3,000-3,500 làm bài tại nhà/trung tâm
- Phân tán trong ngày: 3-8% = 90-280 người
- Tỷ lệ active chat: 25-35% = 23-98 người
- Requests/phút: 40-120 (DISTRIBUTED)

Tải server (baseline):
- CPU per instance: 20-35%
- RAM per instance: 4-6GB
- Total Network: 3-8 Mbps
- Disk I/O: Minimal
- Gemini API: 40-120 calls/phút
- Redis cache hits: 60-70% (higher for offline)
- Database connections: 30-60 concurrent
```

#### Scenario C: Hybrid Peak - Cả Online + Offline (19h-20h30)
```
Thực tế (5,000 học viên):
- Lớp online: 560-780 học sinh (20-30 lớp đồng thời)
- Lớp offline: 100-180 người làm bài ở nhà
- Total concurrent: 660-960 người
- Active chat: 450-650 người (60-70%)
- Requests/phút: 650-950 (ABSOLUTE PEAK)

Tải server (3-4 instances với load balancer):
- CPU per instance: 70-85% (CRITICAL)
- RAM per instance: 12-14GB
- Total Network: 30-50 Mbps
- Disk I/O: Moderate-High
- Gemini API: 650-950 calls/phút
- Redis operations: 2,000-3,000 ops/sec
- Database connections: 200-300 concurrent
- Load balancer: Round-robin across 3-4 instances

⚠️ Auto-scaling MUST trigger at 75% CPU
⚠️ Need at least 4 instances during this period
```

#### Scenario D: Upload Peak - Deadline Bài Tập (Multi-subject)
```
Thực tế (5,000 học viên):
- Online class: Upload cuối giờ
  * 20-30 lớp × 20-25 files = 400-750 files trong 30-45 phút
- Offline class: Upload trước deadline
  * 200-400 người × 1-2 files = 200-800 files trong 2-4 giờ
- Total: 600-1,550 files/ngày

File types mix (ảnh hưởng processing):
- Scratch (.sb3): 40% - 1-3MB - Complex processing
- Web (.html/.css/.js): 25% - 100KB-2MB - Validation
- Python (.py): 20% - 50KB-1MB - Syntax check
- Docs (.pdf/.docx): 15% - 500KB-5MB - Text extraction

Tải server (cần queue system):
- CPU per instance: 75-90% (file processing intensive)
- RAM per instance: 14-16GB (buffer multiple files)
- Total Network: 40-80 Mbps (upload + download)
- Disk I/O: HIGH (temp storage for processing)
- Gemini API: 300-500 calls/phút (file analysis)
- Queue depth: 50-150 pending jobs
- Processing time: 3-8s/file average

⚠️ MUST implement background job queue (Bull/BullMQ)
⚠️ Separate worker instances for file processing (2-3 workers)
```

### 3.3 So Sánh Load: Online vs Offline (5,000 học viên)

| Metric | Lớp Online (1,500-2,000) | Lớp Offline (3,000-3,500) | Ratio |
|--------|--------------------------|---------------------------|-------|
| **Concurrent users peak** | 450-650 (18h-21h) | 90-180 (spread) | 5-7x |
| **Requests/phút** | 650-950 (absolute peak) | 40-120 (distributed) | 8-16x |
| **Upload burst** | 400-750 files/45min | 200-800 files/4h | 4-6x intensity |
| **Response time SLA** | <1.5s (critical) | <3s (acceptable) | 2x |
| **Peak duration** | 3h/ngày (18h-21h) | Distributed 14h (8h-22h) | Concentrated |
| **API calls/ngày** | 35,000-50,000 | 15,000-25,000 | 2-3x |
| **Cache hit rate** | 30-40% (fresh needed) | 60-70% (reusable) | Lower |
| **Database writes** | 8,000-12,000/h | 1,000-3,000/h | 5-8x |

**Khuyến nghị CRITICAL cho 5,000 users:**
- 🔴 **Auto-scaling BẮT BUỘC** - Scale from 2→4 instances at 17h30
- 🔴 **Load Balancer** - Phân phối 650-950 req/min across instances
- 🔴 **Redis Cluster** - 8-16GB for session + cache
- 🔴 **Queue System** - Bull/BullMQ for file processing (200-300 jobs/h)
- 🔴 **Database Replica Set** - Read replicas for analytics
- 🔴 **CDN** - CloudFlare/AWS CloudFront for static assets
- 🔴 **Monitoring 24/7** - PagerDuty alerts for failures
- ✅ Separate worker nodes for background jobs
- ✅ Database sharding by subject (optional Phase 2)

### 3.4 Resource Per Request

| Loại Request | CPU Time | Memory | Network | Latency |
|-------------|----------|---------|---------|---------|
| **Text chat** | 10-30ms | 5-10MB | 1-5KB | 1-3s |
| **Chat + context** | 50-100ms | 15-30MB | 5-20KB | 2-4s |
| **File upload** | 200-500ms | 50-100MB | 1-4MB | 3-8s |
| **Analytics query** | 100-300ms | 20-50MB | 20-100KB | 0.5-2s |

---

## 4. 🎯 Cấu Hình CHỐT Cho 5,000 Học Viên (Production)

### 4.1 ✅ CẤUHÌNH ĐÃ CHỐT - 5,000 học viên (4 bộ môn)

**Lịch học & Load:**
- **T2-T6:** 18h-21h (3h) → 450-650 concurrent users
- **T7/CN:** 9h-21h (12h) → 300-500 concurrent users (phân tán)
- **Online:** 1,500-2,000 học viên (4 bộ môn)
  - Peak: 20-30 lớp × 25-30 học sinh = 500-900 concurrent
- **Offline:** 3,000-3,500 học viên
  - Distributed: 90-180 concurrent (làm bài tại nhà)

### 🏗️ CẤU HÌNH SERVER ĐỀ XUẤT

| Thành phần | Cấu hình | Ghi chú |
|-----------|----------|----------|
| **App Servers** | 3-4 × (8 vCPU, 16GB RAM) | Auto-scale peak 18h-21h + T7/CN |
| **Database** | MongoDB 50-100GB (Replica Set) | 3 nodes, auto-failover |
| **Cache** | Redis 8-16GB (Cluster) | Session + rate limiting |
| **Queue Workers** | 2-3 × (4 vCPU, 8GB RAM) | Xử lý file upload |
| **Load Balancer** | HA Load Balancer | High availability |
| **CDN** | CloudFlare/AWS CloudFront | Static assets |
| **Storage** | 200-500GB SSD/instance | Logs + uploads + backup |
| **Bandwidth** | 3-5 TB/tháng | ~700MB/user/tháng |

### 🔧 Detailed Specifications

#### Application Servers (3-4 instances)
```yaml
Instance Type: High CPU Optimized
- vCPU: 8 cores @ 3.0+ GHz
- RAM: 16GB DDR4
- Storage: 100GB NVMe SSD (OS + app)
- Network: 10 Gbps
- OS: Ubuntu 22.04 LTS
- Runtime: Node.js 20 LTS
- Process Manager: PM2 (4 workers per instance)
- Auto-scaling: 
  * Scale up: CPU > 75% for 3 min
  * Scale down: CPU < 30% for 10 min
  * Min instances: 2
  * Max instances: 6
```

#### MongoDB Replica Set
```yaml
Configuration: M40 or equivalent
Primary Node:
- vCPU: 4 cores
- RAM: 16GB
- Storage: 100GB SSD (IOPS: 3000)
- Backups: Continuous + Daily snapshots (7 days retention)

Secondary Nodes (×2):
- Same specs as Primary
- Read preference: Secondary for analytics
- Auto-failover: <30 seconds

Indexes:
- sessionId, userId, timestamp (compound)
- Sharding: By userId (when >100GB)
```

#### Redis Cluster
```yaml
Configuration: 3 master + 3 replica nodes
Per node:
- Memory: 4-8GB
- Persistence: RDB + AOF
- Eviction: LRU
- Max connections: 10,000
- Network: 10 Gbps

Usage:
- Session cache: 40%
- Response cache: 30%
- Rate limiting: 20%
- Queue metadata: 10%
```

#### Queue Workers (File Processing)
```yaml
Instance Type: Balanced
- vCPU: 4 cores
- RAM: 8GB
- Storage: 50GB SSD (temp files)
- Instances: 2-3 (auto-scale)

Processing capacity:
- 200-300 files/hour
- Parallel jobs: 10-15 concurrent
- Queue: Bull with Redis backend
- Retry: 3 attempts with exponential backoff
```

### 🌐 Network Architecture
```
Internet
    │
    ▼
CloudFlare CDN (DDoS protection + WAF)
    │
    ▼
HA Load Balancer (AWS ALB / GCP LB)
    │
    ├──────┬──────┬──────┐
    ▼      ▼      ▼      ▼
  App1  App2  App3  App4 (Auto-scaling)
    │      │      │      │
    └──────┴──────┴──────┘
           │
    ┌──────┴──────┐
    ▼             ▼
MongoDB         Redis
Replica Set     Cluster
    │             │
    ▼             ▼
  Backup      Queue Workers
```

### 💾 Storage Breakdown
```
Total: 500GB SSD per app instance

Logs (200GB):
- Application logs: 50GB (7 days rotation)
- Access logs: 30GB (3 days rotation)
- Error logs: 20GB (30 days retention)
- Audit logs: 100GB (90 days retention)

Uploads (200GB):
- Temp files: 50GB (24h cleanup)
- Processed files: 100GB (30 days)
- Archives: 50GB (90 days)

System (100GB):
- OS + packages: 20GB
- Application code: 5GB
- Teaching materials cache: 50GB (4 subjects)
- Backup space: 25GB
```

### 📊 Khả Năng Phục Vụ

**Conversations:**
- ✅ 50,000-70,000 conversations/ngày
  - Online: 35,000-50,000 (18h-21h peak)
  - Offline: 15,000-20,000 (distributed)
  
**Performance:**
- ✅ Response time p95:
  - Online: <1.5s (critical SLA)
  - Offline: <2.5s
  - p99: <3s
- ✅ Uptime: 99.9% SLA
- ✅ Error rate: <0.1%

**Capacity:**
- ✅ 20-30 lớp online đồng thời
- ✅ 450-650 concurrent active users (peak)
- ✅ 650-950 requests/minute (peak)
- ✅ 600-1,550 file uploads/ngày
- ✅ Support 4+ subjects simultaneously

**Scalability:**
- ✅ Có thể mở rộng lên 8,000-10,000 users
- ✅ Add thêm bộ môn mới (5-10 minutes deploy)
- ✅ Multi-region ready (HN, HCM, ĐN)

### 🏢 Platform Khuyến Nghị (Production-Grade)

**Option A: AWS (Recommended)**
```
- EC2 instances (c6i.2xlarge)
- Application Load Balancer
- DocumentDB (MongoDB-compatible)
- ElastiCache Redis
- S3 for storage
- CloudFront CDN
- Route53 DNS
- CloudWatch monitoring
```

**Option B: Google Cloud**
```
- Compute Engine (c3-standard-8)
- Cloud Load Balancing
- Cloud MongoDB Atlas
- Memorystore Redis
- Cloud Storage
- Cloud CDN
- Cloud Monitoring
```

**Option C: Azure**
```
- Virtual Machines (F8s v2)
- Azure Load Balancer
- Cosmos DB (MongoDB API)
- Azure Cache for Redis
- Blob Storage
- Azure CDN
- Azure Monitor
```


---

## 5. 📈 Roadmap Triển Khai (5,000 Users)

### Phase 1: Infrastructure Setup (Tuần 1-2)

```
Week 1: Core Infrastructure
✅ Provision 3 application servers (8vCPU, 16GB)
✅ Setup load balancer (HA configuration)
✅ Deploy MongoDB Replica Set (3 nodes, 50GB each)
✅ Deploy Redis Cluster (3 master + 3 replica)
✅ Configure auto-scaling rules
✅ Setup CDN (CloudFlare Enterprise)
✅ Configure domain & SSL

Week 2: Application Deployment
✅ Deploy backend to production
✅ Deploy frontend to CDN
✅ Configure environment variables (4 subjects)
✅ Load teaching materials (280MB total)
✅ Setup monitoring (DataDog/New Relic)
✅ Configure backup automation
✅ Security hardening (WAF, DDoS protection)
```

### Phase 2: Testing & Optimization (Tuần 3-4)

```
Week 3: Load Testing
✅ Simulate 650-950 req/min peak load
✅ Test auto-scaling (2→4→6 instances)
✅ File upload stress test (600-1,550 files)
✅ Database failover testing
✅ Redis cluster testing
✅ API rate limiting verification
✅ Cache hit rate optimization

Week 4: Fine-tuning
✅ Optimize database indexes
✅ Tune cache TTL strategies
✅ Configure queue workers (2-3 instances)
✅ Setup alerting thresholds
✅ Performance baseline documentation
✅ Disaster recovery plan
✅ Staff training
```

### Phase 3: Go-Live (Tuần 5)

```
Migration Strategy:
Day 1-2: Pilot with 500 users (10%)
Day 3-4: Expand to 1,500 users (30%)
Day 5-7: Full rollout 5,000 users (100%)

Monitoring:
- Real-time dashboard for all metrics
- On-call rotation (24/7)
- Incident response team ready
- Rollback plan prepared
```

### Phase 4: Expansion Ready (Tháng 2-3)

```
Prepare for growth to 8,000-10,000 users:
🔄 Add 2 more app instances (total 5-6)
🔄 Upgrade MongoDB to 100GB+ with sharding
🔄 Expand Redis to 32GB cluster
➕ Add more subjects (Game Dev, AI/ML)
➕ Multi-region deployment (HN, HCM, ĐN)
➕ Advanced analytics & reporting
➕ Mobile app support
➕ API for third-party integrations
```

---

## 7. 🔧 Khuyến Nghị Kỹ Thuật

### 7.1 Backend Optimization

#### Rate Limiting (Phân biệt Online/Offline)
```javascript
import rateLimit from 'express-rate-limit';

// Rate limit cao hơn cho online classes
const onlineClassLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15, // 15 requests/phút cho học online
  message: 'Bạn đã hỏi quá nhiều, vui lòng chờ 1 phút.',
  skip: (req) => !isOnlineClassTime(req) // Check class schedule
});

// Rate limit thấp hơn cho offline students
const offlineLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8, // 8 requests/phút cho học offline
  message: 'Bạn đã hỏi quá nhiều, vui lòng chờ 1 phút.'
});

// Smart limiter dựa trên session type
const smartLimiter = (req, res, next) => {
  const sessionType = req.body?.profile?.learningMode; // 'online' or 'offline'
  const isClassTime = isOnlineClassTime(req);
  
  if (sessionType === 'online' || isClassTime) {
    return onlineClassLimiter(req, res, next);
  }
  return offlineLimiter(req, res, next);
};

app.use('/api/chat', smartLimiter);

// Helper function
function isOnlineClassTime(req) {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0-6
  
  // Online classes: 19h-21h, Thứ 2-6
  return hour >= 19 && hour < 21 && day >= 1 && day <= 5;
}
```

#### Connection Pooling
```javascript
import { MongoClient } from 'mongodb';

const client = new MongoClient(uri, {
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 30000
});
```

#### Response Compression
```javascript
import compression from 'compression';

app.use(compression({
  level: 6, // Compression level (0-9)
  threshold: 1024 // Only compress responses > 1KB
}));
```

#### Response Caching (Ưu tiên Offline)
```javascript
import NodeCache from 'node-cache';

const responseCache = new NodeCache({ 
  stdTTL: 300, // 5 phút
  checkperiod: 60
});

// Cache strategy
const shouldCache = (req) => {
  const sessionType = req.body?.profile?.learningMode;
  const isClassTime = isOnlineClassTime(req);
  
  // Ưu tiên cache cho offline students (giảm load)
  // Không cache nhiều cho online (cần real-time, fresh responses)
  if (sessionType === 'offline' || !isClassTime) {
    return true; // Cache aggressively
  }
  return false; // Online: skip cache để đảm bảo fresh
};

app.post('/api/chat', async (req, res) => {
  const questionHash = hashQuestion(req.body.message);
  
  if (shouldCache(req) && responseCache.has(questionHash)) {
    return res.json(responseCache.get(questionHash));
  }
  
  // Process request...
  const response = await processChat(req.body);
  
  if (shouldCache(req)) {
    responseCache.set(questionHash, response);
  }
  
  res.json(response);
});
```

### 7.2 Database Optimization

#### Indexes
```javascript
// Session index
db.sessions.createIndex({ userId: 1, createdAt: -1 });

// Message index
db.messages.createIndex({ sessionId: 1, timestamp: -1 });

// Analytics index
db.analytics.createIndex({ date: -1, event: 1 });
```

#### Data Retention
```javascript
// Xóa messages cũ hơn 90 ngày
db.messages.deleteMany({
  timestamp: { 
    $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) 
  }
});
```

### 7.3 Frontend Optimization

#### Code Splitting
```javascript
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./Dashboard'));
const ScratchWorkspace = lazy(() => import('./ScratchWorkspace'));
```

#### Build Optimization
```javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
          markdown: ['react-markdown', 'remark-gfm']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
};
```

---

## 8. 🛡️ Security Requirements

### 8.1 Security Checklist

```
✅ HTTPS only (Force SSL)
✅ Rate limiting (Prevent DDoS)
✅ Input validation & sanitization
✅ File upload restrictions (4MB, whitelist extensions)
✅ CORS configuration (Restrict origins)
✅ Environment variables (Never commit secrets)
✅ API key rotation (Quarterly)
✅ Regular dependency updates (npm audit weekly)
✅ WAF (Web Application Firewall)
✅ Database encryption at rest
✅ Audit logging
```

### 8.2 Data Privacy

```
✅ User consent for data collection
✅ Data retention policy (90 days)
✅ Right to delete (API endpoint)
✅ Data export functionality
✅ Privacy policy page
✅ Anonymize analytics data
✅ Secure student information (encryption)
```

---

## 9. 📊 Monitoring Requirements

### 9.1 Key Metrics

| Metric | Target | Alert Threshold | Tool |
|--------|--------|-----------------|------|
| **Response Time (p95)** | <2s | >5s | APM |
| **Error Rate** | <1% | >5% | Sentry |
| **CPU Usage** | <60% | >80% | Cloud Provider |
| **Memory Usage** | <70% | >85% | Cloud Provider |
| **Disk Usage** | <70% | >85% | Cloud Provider |
| **API Success Rate** | >99% | <95% | Custom |
| **Gemini API Quota** | <80% | >90% | Custom |
| **Database Connections** | <50 | >80 | MongoDB Atlas |
| **Uptime** | 99.5% | <99% | UptimeRobot |

### 9.2 Health Checks

```javascript
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: await checkDatabaseHealth(),
    geminiApi: await checkGeminiApiHealth()
  };
  
  res.json(health);
});
```

---

## 10. 📋 Decision Matrix

### 10.1 Platform Comparison

| Platform | CPU | RAM | Storage | Bandwidth | Ưu điểm | Nhược điểm | Điểm |
|----------|-----|-----|---------|-----------|---------|------------|------|
| **Render.com** | 1 vCPU | 2GB | 100GB | 100GB | ⭐ Dễ setup, Auto SSL | ❌ Limited resources | 9/10 |
| **Railway.app** | Flexible | Flexible | 100GB | 100GB | ⭐ Great DX, Pay per use | ❌ Quota limits | 8/10 |
| **Fly.io** | 1 vCPU | 256MB→2GB | 10GB→100GB | Unlimited | ⭐ Edge computing | ❌ Phức tạp hơn | 8/10 |
| **Vercel** | N/A | N/A | N/A | Unlimited | ⭐ Perfect for React | ❌ Chỉ frontend | 10/10 |
| **DigitalOcean** | 2 vCPU | 4GB | 80GB | 4TB | ⭐ Full control | ❌ Cần tự setup | 7/10 |
| **AWS Lightsail** | 1-2 vCPU | 2-4GB | 60-80GB | 2-3TB | ⭐ AWS ecosystem | ❌ Phức tạp | 7/10 |

**Khuyến nghị:**
- 🥇 **Frontend:** Vercel/Netlify/Cloudflare Pages
- 🥇 **Backend:** Render.com/Railway.app/Fly.io
- 🥇 **Database:** MongoDB Atlas

---

## 11. 🎯 Kết Luận

### 11.1 Cấu Hình Final - 5,000 Học Viên (4 Bộ Môn)

```
┌──────────────────────────────────────────────────────────────┐
│  PRODUCTION CONFIGURATION - 5,000 USERS (MULTI-SUBJECT)      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  🌐 Frontend (CDN)                                           │
│     └─ CloudFlare/AWS CloudFront                             │
│        ├─ Global edge locations                              │
│        ├─ DDoS protection + WAF                              │
│        └─ Static assets (~50MB)                              │
│                                                               │
│  ⚖️ Load Balancer (HA)                                       │
│     └─ AWS ALB / GCP LB / Azure LB                           │
│        ├─ Health checks (every 30s)                          │
│        ├─ SSL termination                                    │
│        └─ Round-robin distribution                           │
│                                                               │
│  🖥️ Application Servers (Auto-scaling)                      │
│     ├─ Instance: 8 vCPU, 16GB RAM, 100GB SSD                │
│     ├─ Count: 3-4 instances (scale to 6 if needed)          │
│     ├─ Runtime: Node.js 20 + PM2 (4 workers/instance)       │
│     └─ Network: 10 Gbps                                      │
│                                                               │
│  🗄️ MongoDB Replica Set                                     │
│     ├─ Primary: 4vCPU, 16GB RAM, 100GB SSD                  │
│     ├─ Secondary ×2: Same specs as primary                   │
│     ├─ Auto-failover: <30 seconds                           │
│     ├─ Backup: Continuous + Daily snapshots                 │
│     └─ Sharding: By userId (future)                         │
│                                                               │
│  ⚡ Redis Cluster                                            │
│     ├─ 3 master + 3 replica nodes                           │
│     ├─ Memory: 4-8GB per node (total 12-24GB)              │
│     ├─ Persistence: RDB + AOF                                │
│     └─ Usage: Session (40%), Cache (30%), Rate limit (20%)  │
│                                                               │
│  👷 Queue Workers (File Processing)                         │
│     ├─ Instance: 4 vCPU, 8GB RAM, 50GB SSD                  │
│     ├─ Count: 2-3 instances                                  │
│     ├─ Queue: Bull with Redis backend                        │
│     └─ Capacity: 200-300 files/hour                         │
│                                                               │
│  🔌 Gemini API                                               │
│     ├─ Tier: Paid (REQUIRED)                                 │
│     ├─ Rate limit: 1,500-2,000 req/min                      │
│     ├─ Daily quota: 50,000-75,000 calls                     │
│     └─ Monthly: ~1.5-2.25M API calls                        │
│                                                               │
│  📊 Monitoring Stack                                         │
│     ├─ APM: DataDog / New Relic                             │
│     ├─ Logs: ELK Stack / CloudWatch                         │
│     ├─ Alerts: PagerDuty / Opsgenie                         │
│     └─ Uptime: Pingdom / UptimeRobot                        │
│                                                               │
│  💾 Storage & Backup                                         │
│     ├─ Application: 500GB SSD per instance                   │
│     ├─ Logs: 200GB (30 days retention)                      │
│     ├─ Uploads: 200GB (temp + processed)                    │
│     ├─ Teaching materials: 280GB (4 subjects)               │
│     └─ Backups: S3/GCS (90 days retention)                  │
│                                                               │
│  🌍 Multi-Subject Support                                   │
│     ├─ Coding/Scratch: 600-800 users                        │
│     ├─ Web Development: 400-500 users                       │
│     ├─ Python: 300-400 users                                │
│     └─ Computer Science: 200-300 users                      │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Khả năng phục vụ thực tế:**
```
Concurrent Users:
├─ Peak (18h-21h): 450-650 users
│  ├─ Online classes: 560-780 students (20-30 lớp)
│  └─ Offline students: 90-180 concurrent
└─ Baseline (8h-17h): 90-180 users

Conversations:
├─ Daily: 50,000-70,000 conversations
│  ├─ Online: 35,000-50,000 (concentrated)
│  └─ Offline: 15,000-20,000 (distributed)
└─ Monthly: 1.5M-2.1M conversations

File Processing:
├─ Daily: 600-1,550 files
│  ├─ Scratch (.sb3): 40% (~400 files)
│  ├─ Web files: 25% (~250 files)  
│  ├─ Python (.py): 20% (~200 files)
│  └─ Docs: 15% (~150 files)
└─ Processing time: 3-8s/file average

Performance SLA:
├─ Response time p95:
│  ├─ Online: <1.5s (critical)
│  └─ Offline: <2.5s (acceptable)
├─ Response time p99: <3s
├─ Error rate: <0.1%
├─ Uptime: 99.9% (43 minutes downtime/month max)
└─ API success rate: >99.5%
```

### 11.2 Action Items

#### Week 1: Infrastructure Setup
- [ ] Chọn platform (Render/Railway/Fly.io)
- [ ] Đăng ký MongoDB Atlas
- [ ] Đăng ký frontend hosting (Vercel/Netlify)
- [ ] Đăng ký domain
- [ ] Setup Gemini API key
- [ ] Configure environment variables

#### Week 2: Deployment
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Connect MongoDB
- [ ] Configure custom domain
- [ ] Enable SSL/HTTPS
- [ ] Test end-to-end

#### Week 3: Optimization
- [ ] Implement rate limiting
- [ ] Add response caching
- [ ] Setup monitoring
- [ ] Configure error tracking
- [ ] Add analytics
- [ ] Load testing

#### Week 4: Documentation
- [ ] Deployment guide
- [ ] Troubleshooting guide
- [ ] Train support team
- [ ] Backup procedures
- [ ] Incident response plan

### 11.3 Risk Assessment (5,000 Users - Production)

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Gemini API quota exceeded (Peak)** | High | Critical | 🔴 Paid tier 1,500-2,000 req/min, smart cache, priority queue, separate keys per subject |
| **Online class spike (18h-21h)** | High | Critical | 🔴 Auto-scale to 6 instances, pre-warm 17h30, load balancer, Redis cluster |
| **Database overload (650-950 req/min)** | Medium | Critical | 🔴 Replica set with read replicas, connection pooling (max 10K), indexes optimized |
| **Redis failure (cache/session loss)** | Medium | High | 🔴 Cluster mode (3+3), persistence (RDB+AOF), auto-failover <5s |
| **File upload burst (600-1,550/day)** | High | Medium | 🔴 Queue system (Bull), 2-3 workers, parallel processing, S3/GCS storage |
| **Network bottleneck (30-50 Mbps)** | Medium | High | 🔴 CDN (CloudFlare), 10 Gbps instances, compression, WebSocket (future) |
| **Multi-subject context confusion** | Medium | Medium | ⚠️ Subject-aware routing, separate caches, metadata tagging |
| **Security breach / DDoS** | Low | Critical | 🔴 WAF (CloudFlare), rate limiting, IP whitelisting, audit logs |
| **Data loss / corruption** | Low | Critical | 🔴 Daily backups + continuous, 90-day retention, DR plan tested |
| **Monitoring blind spots** | Medium | High | ⚠️ 24/7 monitoring, PagerDuty alerts, health checks every 30s |

**Critical Mitigations (5,000 Users):**

**1. Peak Hour Protection (18h-21h):**
```yaml
Auto-scaling rules:
  Pre-warm: 17h30
    - Scale from 2 → 4 instances
    - Warm up cache with common questions
    - Check all health endpoints
  
  Scale up triggers:
    - CPU > 75% for 2 minutes → +2 instances
    - Memory > 80% for 2 minutes → +2 instances  
    - Request queue > 100 → +1 instance
    - Response time p95 > 2s → +1 instance
  
  Scale down: 21h30
    - Gradual cooldown (1 instance / 10 min)
    - Minimum 2 instances always
    
  Emergency override:
    - Manual scale to 6 instances if needed
    - Circuit breaker if errors > 5%
```

**2. Multi-Subject Routing:**
```javascript
// Smart subject detection & routing
const subjectRouting = {
  'Coding/Scratch': {
    cache_ttl: 300, // 5 min
    priority: 'HIGH',
    gemini_key: 'KEY_SCRATCH',
    context_size: '100MB'
  },
  'Web Development': {
    cache_ttl: 600, // 10 min
    priority: 'HIGH',
    gemini_key: 'KEY_WEB',
    context_size: '60MB'
  },
  'Python': {
    cache_ttl: 600,
    priority: 'MEDIUM',
    gemini_key: 'KEY_PYTHON',
    context_size: '40MB'
  },
  'Computer Science': {
    cache_ttl: 900, // 15 min
    priority: 'MEDIUM',
    gemini_key: 'KEY_CS',
    context_size: '80MB'
  }
};
```

**3. Resource Allocation Strategy:**
```
┌─────────────────────────────────────────┐
│  CAPACITY PLANNING (5,000 users)        │
├─────────────────────────────────────────┤
│  Peak Hours (18h-21h):                  │
│    ├─ 80% capacity → Online (450-650)  │
│    └─ 20% capacity → Offline (90-150)  │
│                                          │
│  Off-Peak (8h-17h, 22h-8h):            │
│    ├─ 30% capacity → Baseline          │
│    └─ 70% capacity → Reserved          │
│                                          │
│  Auto-scaling buffers:                  │
│    ├─ Normal: 2-4 instances             │
│    ├─ Peak: 4-6 instances               │
│    └─ Emergency: Up to 8 instances      │
└─────────────────────────────────────────┘
```

**4. Disaster Recovery Plan:**
```
RTO (Recovery Time Objective): 15 minutes
RPO (Recovery Point Objective): 5 minutes

Backup Strategy:
├─ Continuous backup (MongoDB)
├─ Hourly snapshots (Redis)
├─ Daily full backups (All data)
└─ 90-day retention

Failover Procedures:
├─ Database: Auto-failover <30s
├─ Redis: Auto-failover <5s
├─ App servers: Health check every 30s, auto-replace
└─ Load balancer: HA pair, instant failover

Recovery Scenarios:
├─ Single instance failure: Auto-replace (2-3 min)
├─ Database failure: Promote secondary (30s)
├─ Region outage: Failover to backup region (10-15 min)
└─ Complete disaster: Restore from backup (15-30 min)
```

**5. Cost Optimization (Production):**
```
Reserved Instances (1-year commit):
├─ Application servers: 40% savings
├─ Database: 30-50% savings
└─ Redis: 30% savings

Spot Instances for workers:
├─ Queue workers: Up to 70% savings
└─ Batch processing: Significant savings

Auto-scaling efficiency:
├─ Scale down aggressively off-peak
├─ Use smaller instances when possible
└─ Monitor and optimize monthly
```

---

## 12. 📞 Contacts & Support

**Technical Lead:** Technical Team  
**Email:** tech@mindx.edu.vn  

**Platform Support:**
- Render: support@render.com
- MongoDB: support@mongodb.com
- Google Cloud: cloud-support@google.com

---

## 13. 📎 Phụ Lục

### A. Glossary

| Term | Definition |
|------|------------|
| **vCPU** | Virtual CPU - Đơn vị xử lý ảo hóa |
| **Concurrent Users** | Số người dùng online cùng lúc |
| **p95 Response Time** | 95% requests có thời gian phản hồi dưới ngưỡng |
| **Rate Limiting** | Giới hạn số request để tránh abuse |
| **CDN** | Content Delivery Network |
| **SLA** | Service Level Agreement |

### B. Useful Commands

```bash
# Check server resources
htop
df -h
free -m

# Monitor Node.js process
pm2 monit
pm2 logs

# Test API endpoint
curl -X POST https://api.domain.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'

# Load testing
npx artillery quick --count 100 --num 10 https://api.domain.com

# Check SSL certificate
openssl s_client -connect domain.com:443

# Database backup
mongodump --uri="mongodb+srv://..." --out=/backup
```

### C. References

- [Render.com Documentation](https://render.com/docs)
- [MongoDB Best Practices](https://docs.mongodb.com/manual/administration/production-notes/)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Express.js Performance](https://expressjs.com/en/advanced/best-practice-performance.html)
- [React Optimization](https://react.dev/learn)

---

**Ngày cập nhật:** 27/11/2025  
**Version:** 1.0  
**Status:** ✅ Ready for Implementation

---

> 💡 **Ghi chú:** Báo cáo này tập trung vào yêu cầu cấu hình kỹ thuật. Các con số được tính toán dựa trên phân tích chi tiết source code và usage patterns dự kiến.
