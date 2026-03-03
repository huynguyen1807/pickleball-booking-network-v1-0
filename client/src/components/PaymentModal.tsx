import React, { useState } from 'react';
import api from '../api/axios';
import styles from '../styles/Payment.module.css';

interface PaymentModalProps {
  isOpen: boolean;
  bookingId: number;
  amount: number;
  onClose: () => void;
  onSuccess: (data: any) => void;
}

export default function PaymentModal({
  isOpen,
  bookingId,
  amount,
  onClose,
  onSuccess
}: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayWithPayOS = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('[PaymentModal] Starting payment init with:', { bookingId, amount });
      
      // Call backend để init PayOS
      const response = await api.post('/payments/payos-init', {
        booking_id: bookingId
      });

      console.log('[PaymentModal] Response from backend:', response);
      console.log('[PaymentModal] Response data:', response.data);
      console.log('[PaymentModal] Response code:', response.data.code);

      if (response.data.code === 0 || response.data.code === '00' || response.data.code === '0') {
        console.log('[PaymentModal] Payment init success');
        const { checkoutUrl, qrCode, orderCode, paymentLinkId } = response.data.data;

        console.log('[PaymentModal] Extracted data:', { 
          checkoutUrl: checkoutUrl?.substring(0, 50) + '...', 
          qrCode: qrCode?.substring(0, 50) + '...', 
          orderCode, 
          paymentLinkId 
        });

        // Truyền dữ liệu tới parent component
        onSuccess({
          method: 'payos',
          checkoutUrl,
          qrCode,
          orderCode,
          paymentLinkId,
          amount
        });

        console.log('[PaymentModal] onSuccess called');
        onClose();
      } else {
        console.error('[PaymentModal] Error code from backend:', response.data.code, response.data.desc);
        setError(response.data.desc || 'Lỗi khởi tạo thanh toán');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('[PaymentModal] Error occurred:', err);
      console.error('[PaymentModal] Error response:', err.response);
      console.error('[PaymentModal] Error message:', err.response?.data?.message);
      setError(err.response?.data?.message || 'Lỗi kết nối tới server');
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>💳 Thanh Toán Booking</h2>
          <button 
            onClick={onClose} 
            className={styles.closeBtn}
            disabled={loading}
          >
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.paymentAmount}>
            Số tiền: <strong>{amount.toLocaleString('vi-VN')} VND</strong>
          </p>

          {error && (
            <div className={styles.errorMessage}>
              ⚠️ {error}
            </div>
          )}

          <div className={styles.paymentOptions}>
            {/* PayOS Option */}
            <button
              className={`${styles.paymentOption} ${styles.payos}`}
              onClick={handlePayWithPayOS}
              disabled={loading}
            >
              <div className={styles.icon}>
                <span>P</span>
              </div>
              <div className={styles.info}>
                <span className={styles.title}>PayOS</span>
                <span className={styles.subtitle}>Quét QR hoặc chuyển khoản</span>
                <span className={styles.description}>24/7 Napas - Liên ngân hàng</span>
              </div>
              {loading && <div className={styles.spinner}></div>}
            </button>
          </div>

          <div className={styles.modalFooter}>
            <button 
              onClick={onClose} 
              className={styles.btnCancel}
              disabled={loading}
            >
              Hủy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
