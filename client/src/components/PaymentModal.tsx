import React, { useState } from 'react';
import api from '../api/axios';
import styles from '../styles/Payment.module.css';

interface PaymentModalProps {
  isOpen: boolean;
  bookingPayload: any;
  bookingId?: number | null;
  amount: number;
  onClose: () => void;
  onSuccess: (data: any) => void;
}

export default function PaymentModal({
  isOpen,
  bookingPayload,
  bookingId,
  amount,
  onClose,
  onSuccess
}: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);

  React.useEffect(() => {
    if (!isOpen) return;

    const loadBalance = async () => {
      try {
        const res = await api.get('/users/me/balance');
        setBalance(Number(res.data?.balance || 0));
      } catch {
        setBalance(0);
      }
    };

    loadBalance();
  }, [isOpen]);

  const handlePayWithPayOS = async () => {
    setLoading(true);
    setError(null);
    try {
      let newBookingId = bookingId;
      if (!newBookingId) {
          // Create booking first
          const bookingRes = await api.post('/bookings', bookingPayload);
          newBookingId = bookingRes.data.bookingId || bookingRes.data.id;
      }

      // Call backend để init PayOS
      const response = await api.post('/payments/payos-init', {
        booking_id: newBookingId
      });

      if (response.data.code === 0 || response.data.code === '00' || response.data.code === '0') {
        const { checkoutUrl, qrCode, orderCode, paymentLinkId } = response.data.data;

        // Truyền dữ liệu tới parent component
        onSuccess({
          bookingId: newBookingId,
          method: 'payos',
          checkoutUrl,
          qrCode,
          orderCode,
          paymentLinkId,
          amount
        });
        onClose();
      } else {
        console.error('[PaymentModal] Error code from backend:', response.data.code, response.data.desc);
        setError(response.data.desc || 'Lỗi khởi tạo thanh toán');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('[PaymentModal] Error occurred:', err);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || 'Lỗi kết nối tới server';
      setError(errorMsg);
      setLoading(false);
    }
  };

  const handlePayWithBalance = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/payments/balance-pay', {
        booking_id: bookingId
      });

      const payload = response.data?.data || response.data;
      onSuccess({
        method: 'balance',
        amount,
        currentBalance: Number(payload?.currentBalance || 0)
      });
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể thanh toán bằng ví';
      const currentBalance = Number(err.response?.data?.currentBalance || 0);
      const requiredAmount = Number(err.response?.data?.requiredAmount || amount);

      if (msg.includes('Số dư ví không đủ')) {
        setError(`${msg}. Số dư hiện tại: ${currentBalance.toLocaleString('vi-VN')}đ, cần: ${requiredAmount.toLocaleString('vi-VN')}đ`);
      } else {
        setError(msg);
      }
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

          <p style={{ textAlign: 'center', margin: '0 0 12px', color: '#14532d', fontWeight: 600 }}>
            Số dư ví: {balance.toLocaleString('vi-VN')}đ
          </p>

          {error && (
            <div className={styles.errorMessage}>
              ⚠️ {error}
            </div>
          )}

          <div className={styles.paymentOptions}>
            <button
              className={`${styles.paymentOption} ${styles.balance}`}
              onClick={handlePayWithBalance}
              disabled={loading || balance < amount}
            >
              <div className={styles.icon}>
                <span>₫</span>
              </div>
              <div className={styles.info}>
                <span className={styles.title}>Ví người dùng</span>
                <span className={styles.subtitle}>Trừ trực tiếp từ số dư ví</span>
                <span className={styles.description}>
                  {balance >= amount ? 'Thanh toán tức thì, không cần quét QR' : 'Số dư ví không đủ'}
                </span>
              </div>
              {loading && <div className={styles.spinner}></div>}
            </button>

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
