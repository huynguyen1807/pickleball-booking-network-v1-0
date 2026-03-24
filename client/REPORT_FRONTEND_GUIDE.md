# Frontend Integration Guide - Report System

## Setup

### 1. Add Report API Helper
Create `client/src/api/reportAPI.ts`

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api'
});

export const reportAPI = {
  // User endpoints
  createReport: async (reportData: {
    report_type: 'account' | 'post' | 'impostor' | 'court' | 'other';
    report_target_id?: number;
    report_target_type?: 'user' | 'post' | 'court';
    description: string;
    evidence_urls?: string[];
  }) => {
    return api.post('/reports', reportData);
  },

  getMyReports: () => {
    return api.get('/reports/my-reports');
  },

  // Admin endpoints
  getAllReports: (status?: string, report_type?: string, page = 1) => {
    return api.get('/reports', {
      params: { status, report_type, page }
    });
  },

  getReportById: (id: number) => {
    return api.get(`/reports/${id}`);
  },

  updateReportStatus: (id: number, status: string, admin_note?: string) => {
    return api.put(`/reports/${id}`, { status, admin_note });
  },

  deleteReport: (id: number) => {
    return api.delete(`/reports/${id}`);
  }
};

export default reportAPI;
```

---

### 2. Create Report Modal Component
Create `client/src/components/ReportModal.tsx`

```typescript
import React, { useState } from 'react';
import { reportAPI } from '../api/reportAPI';
import styles from './ReportModal.module.css';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId?: number;
  targetType?: 'user' | 'post' | 'court';
  targetName?: string;
}

const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetId,
  targetType,
  targetName
}) => {
  const [reportType, setReportType] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await reportAPI.createReport({
        report_type: reportType as any,
        report_target_id: targetId,
        report_target_type: targetType,
        description,
        evidence_urls: []
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setDescription('');
        setReportType('');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi khi gửi báo cáo');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Báo Cáo</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {success ? (
          <div className={styles.success}>
            ✅ Báo cáo đã được gửi. Cảm ơn bạn!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {targetName && (
              <p className={styles.target}>Báo cáo: {targetName}</p>
            )}

            <div className={styles.group}>
              <label>Loại vi phạm *</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                required
              >
                <option value="">Chọn loại vi phạm</option>
                <option value="account">Tài khoản vi phạm</option>
                <option value="post">Bài viết không phù hợp</option>
                <option value="impostor">Tài khoản giả mạo</option>
                <option value="court">Sân không hợp lệ</option>
                <option value="other">Khác</option>
              </select>
            </div>

            <div className={styles.group}>
              <label>Mô tả chi tiết *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Vui lòng cung cấp chi tiết về vi phạm..."
                rows={5}
                required
              />
              <small>{description.length}/500</small>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
              <button
                type="button"
                onClick={onClose}
                className={styles.cancelBtn}
              >
                Hủy
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={loading}
              >
                {loading ? 'Đang gửi...' : 'Gửi Báo Cáo'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
```

---

### 3. Add Report Button to User Profile
Example: `client/src/components/UserProfile.tsx`

```typescript
import { useState } from 'react';
import ReportModal from './ReportModal';

export const UserProfile = ({ user }) => {
  const [showReportModal, setShowReportModal] = useState(false);

  return (
    <div>
      {/* Other profile content */}
      
      <button 
        className="btn-secondary"
        onClick={() => setShowReportModal(true)}
      >
        🚩 Báo cáo tài khoản
      </button>

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetId={user.id}
        targetType="user"
        targetName={user.full_name}
      />
    </div>
  );
};
```

---

### 4. Add Report Button to Posts
Example: `client/src/components/PostCard.tsx`

```typescript
<button
  onClick={() => setShowReportModal(true)}
  className="btn-icon"
  title="Báo cáo bài viết"
>
  🚩
</button>

<ReportModal
  isOpen={showReportModal}
  onClose={() => setShowReportModal(false)}
  targetId={post.id}
  targetType="post"
  targetName={`Bài viết từ ${post.author_name}`}
/>
```

---

### 5. Create Admin Report Dashboard
Create `client/src/pages/AdminReportDashboard.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { reportAPI } from '../api/reportAPI';
import styles from './AdminReportDashboard.module.css';

interface Report {
  id: number;
  reporter_name: string;
  report_type: string;
  report_target_id: number;
  report_target_type: string;
  description: string;
  status: string;
  created_at: string;
}

const AdminReportDashboard: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [adminNote, setAdminNote] = useState('');

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  const fetchReports = async () => {
    try {
      const res = await reportAPI.getAllReports(statusFilter);
      setReports(res.data.data);
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (reportId: number, newStatus: string) => {
    try {
      await reportAPI.updateReportStatus(reportId, newStatus, adminNote);
      setAdminNote('');
      setSelectedReport(null);
      fetchReports();
      alert('Cập nhật thành công');
    } catch (err) {
      alert('Lỗi cập nhật');
    }
  };

  return (
    <div className={styles.container}>
      <h1>📋 Quản Lý Báo Cáo</h1>

      <div className={styles.filters}>
        <button
          className={statusFilter === 'pending' ? styles.active : ''}
          onClick={() => setStatusFilter('pending')}
        >
          ⏳ Chờ Xử Lý
        </button>
        <button
          className={statusFilter === 'investigating' ? styles.active : ''}
          onClick={() => setStatusFilter('investigating')}
        >
          🔍 Đang Điều Tra
        </button>
        <button
          className={statusFilter === 'resolved' ? styles.active : ''}
          onClick={() => setStatusFilter('resolved')}
        >
          ✅ Đã Giải Quyết
        </button>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Người báo cáo</th>
            <th>Loại vi phạm</th>
            <th>Mô tả</th>
            <th>Trạng thái</th>
            <th>Thời gian</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.id}>
              <td>#{report.id}</td>
              <td>{report.reporter_name}</td>
              <td>
                <span className={`badge badge-${report.report_type}`}>
                  {report.report_type}
                </span>
              </td>
              <td>{report.description.substring(0, 50)}...</td>
              <td>
                <span className={`status status-${report.status}`}>
                  {report.status}
                </span>
              </td>
              <td>{new Date(report.created_at).toLocaleDateString('vi-VN')}</td>
              <td>
                <button
                  onClick={() => setSelectedReport(report)}
                  className={styles.viewBtn}
                >
                  Xem chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedReport && (
        <div className={styles.detailModal}>
          <div className={styles.detailContent}>
            <h2>Chi tiết báo cáo #{selectedReport.id}</h2>
            <p><strong>Người báo cáo:</strong> {selectedReport.reporter_name}</p>
            <p><strong>Loại:</strong> {selectedReport.report_type}</p>
            <p><strong>Mô tả:</strong> {selectedReport.description}</p>

            <textarea
              placeholder="Ghi chú admin..."
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={4}
            />

            <div className={styles.actions}>
              <button
                onClick={() => handleStatusUpdate(selectedReport.id, 'investigating')}
              >
                🔍 Đang điều tra
              </button>
              <button
                onClick={() => handleStatusUpdate(selectedReport.id, 'resolved')}
                className={styles.successBtn}
              >
                ✅ Giải quyết
              </button>
              <button
                onClick={() => handleStatusUpdate(selectedReport.id, 'rejected')}
                className={styles.dangerBtn}
              >
                ❌ Từ chối
              </button>
              <button
                onClick={() => setSelectedReport(null)}
                className={styles.cancelBtn}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReportDashboard;
```

---

## CSS Module Example
Create `client/src/components/ReportModal.module.css`

```css
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  padding: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.header h2 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.closeBtn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
}

.form {
  padding: 20px;
}

.group {
  margin-bottom: 16px;
}

.group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.group select,
.group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;
}

.group textarea {
  resize: vertical;
  min-height: 120px;
}

.group small {
  display: block;
  margin-top: 4px;
  color: #999;
  font-size: 12px;
}

.error {
  color: #d32f2f;
  margin: 12px 0;
  padding: 10px;
  background: #ffebee;
  border-radius: 4px;
}

.success {
  padding: 20px;
  text-align: center;
  color: #388e3c;
  font-size: 16px;
  font-weight: 500;
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.cancelBtn,
.submitBtn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.cancelBtn {
  background: #f0f0f0;
  color: #333;
}

.cancelBtn:hover {
  background: #e0e0e0;
}

.submitBtn {
  background: #d32f2f;
  color: white;
}

.submitBtn:hover:not(:disabled) {
  background: #b71c1c;
}

.submitBtn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.target {
  color: #666;
  font-size: 14px;
  margin-bottom: 16px;
}
```

---

## Integration Steps

1. ✅ Create `reportAPI.ts` in `api/` folder
2. ✅ Create `ReportModal.tsx` component
3. ✅ Add report buttons to user profiles
4. ✅ Add report buttons to posts
5. ✅ Create admin dashboard at `/admin/reports`
6. ✅ Update routing to include `/admin/reports`

---

## Testing

```bash
# Create a test report
curl -X POST http://localhost:5000/api/reports \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "report_type": "impostor",
    "report_target_id": 123,
    "report_target_type": "user",
    "description": "Test report"
  }'

# Get all reports (admin)
curl http://localhost:5000/api/reports \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## Notes

- All report-related code is modular and doesn't affect existing functionality
- Reports are soft-deleted (can be recovered from database if needed)
- Notifications are auto-sent to admins and involved users
- Admin can see reporter information but users can't see admin decisions
