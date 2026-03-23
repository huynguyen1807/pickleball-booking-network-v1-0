import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axios';
import styles from '../styles/Modal.module.css';

interface ReportModalProps {
  isOpen: boolean;
  targetId?: number;
  targetType?: 'user' | 'post' | 'court';
  targetName?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

type ReportType = 'account' | 'post' | 'impostor' | 'court' | 'other';

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'account', label: 'Tài khoản vi phạm' },
  { value: 'post', label: 'Bài viết vi phạm' },
  { value: 'impostor', label: 'Tài khoản giả mạo' },
  { value: 'court', label: 'Sân không đạt chuẩn' },
  { value: 'other', label: 'Khác' },
];

export default function ReportModal({
  isOpen,
  targetId,
  targetType,
  targetName,
  onClose,
  onSuccess
}: ReportModalProps) {
  const [reportType, setReportType] = useState<ReportType>('account');
  const [description, setDescription] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!description.trim()) {
        setError('Vui lòng nhập mô tả chi tiết về vấn đề');
        setLoading(false);
        return;
      }

      const evidenceUrls = evidenceUrl.trim() ? [evidenceUrl] : [];

      const response = await api.post('/reports', {
        report_type: reportType,
        report_target_id: targetId || null,
        report_target_type: targetType || null,
        description: description.trim(),
        evidence_urls: evidenceUrls
      });

      setSuccess(true);
      setDescription('');
      setEvidenceUrl('');
      setReportType('account');

      setTimeout(() => {
        setSuccess(false);
        onClose();
        onSuccess?.();
      }, 2000);
    } catch (err: any) {
      console.error('Report error:', err);
      setError(
        err.response?.data?.message ||
        'Gửi báo cáo thất bại. Vui lòng thử lại sau.'
      );
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const modal = (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalContent}
        style={{ maxWidth: '500px', animation: 'slideUp 0.3s ease' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>Gửi báo cáo</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: 0,
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✕
          </button>
        </div>

        {success ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: 'var(--accent-green)'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✓</div>
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>Báo cáo đã được gửi!</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Cảm ơn bạn. Admin sẽ xem xét báo cáo của bạn sớm.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Target Info */}
            {targetName && (
              <div style={{
                background: 'var(--bg-secondary)',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                fontSize: '0.9rem'
              }}>
                <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Đối tượng báo cáo:</div>
                <div style={{ fontWeight: 600 }}>
                  {targetType === 'user' && '(Người dùng) '} 
                  {targetType === 'post' && '(Bài viết) '} 
                  {targetType === 'court' && '(Sân) '} 
                  {targetName}
                </div>
              </div>
            )}

            {/* Report Type Selection */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.95rem' }}>
                Loại báo cáo
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {REPORT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setReportType(type.value)}
                    style={{
                      padding: '12px',
                      border: reportType === type.value ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                      background: reportType === type.value ? 'var(--accent-blue-dim)' : 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 500,
                      transition: 'all 0.2s',
                      color: 'var(--text-primary)',
                      textAlign: 'center'
                    }}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.95rem' }}>
                Mô tả chi tiết *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Vui lòng mô tả chi tiết vấn đề bạn gặp phải..."
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'inherit',
                  fontSize: '0.95rem',
                  minHeight: '100px',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-secondary)',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Evidence URL */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.95rem' }}>
                Link chứng cứ (không bắt buộc)
              </label>
              <input
                type="url"
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://example.com/evidence.png"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'inherit',
                  fontSize: '0.95rem',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-secondary)',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div style={{
                background: 'var(--accent-red-dim)',
                color: 'var(--accent-red)',
                padding: '10px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                fontSize: '0.9rem'
              }}>
                ⚠ {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '11px',
                background: loading ? 'var(--text-tertiary)' : 'var(--accent-blue)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Đang gửi...' : 'Gửi báo cáo'}
            </button>
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
