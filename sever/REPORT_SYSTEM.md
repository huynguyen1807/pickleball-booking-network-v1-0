# Report System Documentation

## Overview
Hệ thống báo cáo cho phép người dùng báo cáo những vi phạm, tài khoản giả mạo, bài viết không hợp lệ, và những vấn đề khác. Admin có thể xem, xử lý và giải đáp các báo cáo.

## Features

### 1. Report Types (Loại báo cáo)
- **account**: Báo cáo tài khoản vi phạm chính sách
- **post**: Báo cáo bài viết không phù hợp
- **impostor**: Báo cáo tài khoản giả mạo
- **court**: Báo cáo sân không tồn tại/không hợp lệ
- **other**: Các loại khác

### 2. Report Status (Trạng thái báo cáo)
- **pending**: Chờ xử lý (mặc định)
- **investigating**: Đang điều tra
- **resolved**: Đã giải quyết
- **rejected**: Từ chối

## API Endpoints

### User Endpoints

#### 1. Create Report
```
POST /api/reports
Authentication: Required
```

**Request Body:**
```json
{
  "report_type": "account|post|impostor|court|other",
  "report_target_id": 123,
  "report_target_type": "user|post|court",
  "description": "Mô tả chi tiết vi phạm",
  "evidence_urls": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"]
}
```

**Response:**
```json
{
  "message": "Báo cáo đã được gửi",
  "reportId": 1
}
```

**Validation Rules:**
- Không được báo cáo chính mình (nếu account type)
- Description không được để trống
- Không được báo cáo 2 lần trong 24 giờ cho cùng đối tượng
- Target phải tồn tại trong hệ thống

---

#### 2. Get My Reports
```
GET /api/reports/my-reports
Authentication: Required
```

**Response:**
```json
[
  {
    "id": 1,
    "report_type": "account",
    "report_target_id": 123,
    "report_target_type": "user",
    "description": "Mô tả",
    "status": "pending",
    "admin_note": null,
    "created_at": "2026-03-22T21:49:52.000Z",
    "updated_at": "2026-03-22T21:49:52.000Z"
  }
]
```

---

### Admin Endpoints

#### 1. Get All Reports (Paginated)
```
GET /api/reports?status=pending&report_type=account&page=1
Authentication: Required (Admin only)
```

**Query Parameters:**
- `status`: Filter by status (pending|investigating|resolved|rejected)
- `report_type`: Filter by report type
- `page`: Page number (default: 1)

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "reporter_id": 5,
      "reporter_name": "Nguyễn Văn A",
      "reporter_email": "user@example.com",
      "report_type": "account",
      "report_target_id": 123,
      "report_target_type": "user",
      "description": "Tài khoản này sử dụng tôi",
      "status": "pending",
      "admin_note": null,
      "resolved_by": null,
      "resolved_by_name": null,
      "created_at": "2026-03-22T21:49:52.000Z",
      "updated_at": "2026-03-22T21:49:52.000Z"
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 20,
  "pages": 1
}
```

---

#### 2. Get Report Details
```
GET /api/reports/:id
Authentication: Required (Admin only)
```

**Response:** Same as individual report object above

---

#### 3. Update Report Status
```
PUT /api/reports/:id
Authentication: Required (Admin only)
```

**Request Body:**
```json
{
  "status": "investigating|resolved|rejected",
  "admin_note": "Chi tiết xử lý báo cáo"
}
```

**Response:**
```json
{
  "message": "Cập nhật báo cáo thành công"
}
```

**Side Effects:**
- Gửi thông báo cho người báo cáo về cập nhật trạng thái
- Gửi thông báo cho người bị báo cáo (nếu report_target_type === 'user')

---

#### 4. Delete Report
```
DELETE /api/reports/:id
Authentication: Required (Admin only)
```

**Response:**
```json
{
  "message": "Xóa báo cáo thành công"
}
```

---

## Database Schema

### reports Table
```sql
CREATE TABLE reports (
  id INT IDENTITY(1,1) PRIMARY KEY,
  reporter_id INT NOT NULL,              -- User báo cáo
  report_type NVARCHAR(50),              -- Loại báo cáo
  report_target_id INT,                  -- ID của đối tượng bị báo cáo
  report_target_type NVARCHAR(50),       -- Loại đối tượng (user/post/court)
  description NVARCHAR(MAX),             -- Mô tả chi tiết
  evidence_urls NVARCHAR(MAX),           -- JSON array URLs bằng chứng
  status NVARCHAR(20),                   -- Trạng thái (pending/investigating/resolved/rejected)
  admin_note NVARCHAR(MAX),              -- Ghi chú của admin
  resolved_by INT,                       -- Admin xử lý
  created_at DATETIMEOFFSET,
  updated_at DATETIMEOFFSET
)
```

---

## Notifications

### 1. Khi có báo cáo mới
- Admin nhận notification: "Có báo cáo mới: [report_type]"
- Type: `report`
- reference_id: report ID

### 2. Khi admin cập nhật trạng thái
**Cho người báo cáo:**
- Notification: "Báo cáo của bạn đã được xử lý"
- Type: `report_update`

**Cho người bị báo cáo (user report):**
- Notification: "Báo cáo về bạn đã được xử lý"
- Type: `report_resolved`
- Bao gồm admin_note (lý do)

---

## Usage Examples

### Create Report (Frontend)
```typescript
const createReport = async () => {
  const response = await axios.post('/api/reports', {
    report_type: 'impostor',
    report_target_id: 123,
    report_target_type: 'user',
    description: 'Tài khoản này giả mạo tôi, sửa dụng ảnh đại diện của tôi',
    evidence_urls: ['url_to_evidence1.jpg', 'url_to_evidence2.jpg']
  });
  console.log(response.data.reportId);
};
```

### Get Admin Reports Dashboard
```typescript
const getReports = async (page = 1, status = 'pending') => {
  const response = await axios.get(`/api/reports?page=${page}&status=${status}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};
```

### Update Report Status
```typescript
const updateReportStatus = async (reportId, status, note) => {
  await axios.put(`/api/reports/${reportId}`, {
    status: 'resolved',
    admin_note: 'Tài khoản đã bị xóa vì vi phạm chính sách'
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
};
```

---

## Security & Validation

✅ **User can:**
- Create reports
- View their own reports
- Only report valid targets that exist in system
- No self-reporting for accounts

✅ **Admin can:**
- View all reports
- Filter by status and type
- Update status and add notes
- Delete reports
- See reporter and target information

✅ **System:**
- Prevents duplicate reports within 24 hours
- Validates report type
- Auto-creates notifications
- Uses indexed queries for performance
- Maintains audit trail (created_at, resolved_by)

---

## Integration Notes

### No Impact on Existing Code
- ✅ Separate routes at `/api/reports`
- ✅ Separate controller and database table
- ✅ No changes to existing routes
- ✅ Uses existing auth middleware
- ✅ Uses existing notification system
- ✅ Compatible with existing role-based access

### How to Run Migration
```bash
npm run migrate
# OR
sqlcmd -S localhost -U sa -P 123456 -d pickleball_danang -i "database/06-add-reports-table.sql"
```

---

## Future Enhancements

- [ ] Auto-ban users after X confirmed reports
- [ ] Report categories with predefined violation types
- [ ] File upload for evidence (not just URLs)
- [ ] Report expiry (auto-reject after 30 days if not resolved)
- [ ] Moderator role between admin and user
- [ ] Report history/audit log
- [ ] Appeal process for rejected reports
- [ ] Mass report detection (prevent spam)
