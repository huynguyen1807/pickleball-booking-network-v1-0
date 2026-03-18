import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import styles from '../styles/Payment.module.css';

interface PayOSPaymentProps {
  checkoutUrl: string;
  orderCode: number;
  paymentLinkId: string;
  amount: number;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function PayOSPayment({
  checkoutUrl,
  orderCode,
  paymentLinkId,
  amount,
  onSuccess,
  onCancel
}: PayOSPaymentProps) {
  const [status, setStatus] = useState<
    'pending' | 'completed' | 'failed' | 'expired' | 'cancelled'
  >('pending');
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes
  const [polling, setPolling] = useState(true);
  const payosWindow = useRef<Window | null>(null);
  const hasOpenedWindow = useRef(false);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          setStatus('expired');
          setPolling(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Auto-open checkout URL in new tab (only once on mount)
  useEffect(() => {
    if (checkoutUrl && !hasOpenedWindow.current) {
      const newWindow = window.open(checkoutUrl, '_blank');
      payosWindow.current = newWindow;
      hasOpenedWindow.current = true;
    }
  }, [checkoutUrl]);

  // When timer expires, mark payment as 'expired' in DB immediately
  useEffect(() => {
    if (status !== 'expired') return;
    api.patch(`/payments/cancel-by-order?orderCode=${orderCode}&newStatus=expired`)
      .catch(() => { /* best-effort — backend job will catch it if this fails */ });
  }, [status, orderCode]);

  // Poll payment status
  useEffect(() => {
    if (!polling || status !== 'pending') return;

    const pollInterval = setInterval(async () => {
      try {
        // Poll backend for payment status
        const res = await api.get(
          `/payments/payos-status/${orderCode}`
        );
        const currentStatus = res.data?.status ?? res.data?.data?.status;

        if (currentStatus === 'completed') {
          setStatus('completed');
          setPolling(false);
          
          // Đóng tab PayOS sau khi thanh toán thành công
          setTimeout(() => {
            if (payosWindow.current && !payosWindow.current.closed) {
              payosWindow.current.close();
            }
            // Focus về tab gốc
            window.focus();
          }, 100);
          
          // Delay thêm 2s để ensure webhook processed
          setTimeout(() => {
            onSuccess();
          }, 2000);
        } else if (currentStatus === 'failed') {
          setStatus('failed');
          setPolling(false);
        } else if (currentStatus === 'cancelled') {
          setStatus('cancelled');
          setPolling(false);
        } else if (currentStatus === 'expired') {
          setStatus('expired');
          setPolling(false);
        }
      } catch (err) {
        console.error('Poll error:', err);
        // Continue polling despite errors
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [orderCode, polling, onSuccess]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRedirectToPayOS = () => {
    if (!payosWindow.current || payosWindow.current.closed) {
      const newWindow = window.open(checkoutUrl, '_blank');
      payosWindow.current = newWindow;
    } else {
      // Nếu tab đã mở, focus vào tab đó
      payosWindow.current.focus();
    }
  };

  return (
    <div className={styles.payosPaymentContainer}>
      {status === 'pending' && (
        <div className={styles.paymentPending}>
          <h2>💳 Thanh toán qua PayOS</h2>

          {/* Amount Display */}
          <div className={styles.amountSection}>
            <p>Số tiền thanh toán</p>
            <h3>{amount.toLocaleString('vi-VN')} VNĐ</h3>
            <p className={styles.orderInfo}>
              Mã đơn: <strong>{orderCode}</strong>
            </p>
          </div>

          {/* Timer */}
          <div className={styles.timerSection}>
            <p>Hết hạn trong:</p>
            <span className={styles.timer}>{formatTime(timeLeft)}</span>
            {timeLeft < 60 && (
              <p className={styles.warning}>
                ⚠️ Sắp hết hạn, vui lòng thanh toán ngay
              </p>
            )}
          </div>

          {/* Redirect Button */}
          <button
            onClick={handleRedirectToPayOS}
            className={styles.btnPayosCheckout}
          >
          Thanh toán ngay
          </button>

          {/* Status Indicator */}
          <div className={styles.statusIndicator}>
            <div className={styles.spinnerSmall}></div>
            <span>Đang chờ xác nhận thanh toán...</span>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Sau khi thanh toán xong, trang này sẽ tự động cập nhật.
          </p>
        </div>
      )}

      {status === 'completed' && (
        <div className={styles.paymentSuccess}>
          <div className={styles.successIcon}>✓</div>
          <h2>✅ Thanh toán thành công!</h2>
          <p className={styles.amount}>
            {amount.toLocaleString('vi-VN')} VND
          </p>
          <p className={styles.message}>
            Giao dịch của bạn đã được xác nhận. 
            Booking sẽ được confirm trong vài giây.
          </p>
          <div className={styles.orderDetails}>
            <div className={styles.detailRow}>
              <span>Mã đơn hàng:</span>
              <strong>{orderCode}</strong>
            </div>
            <div className={styles.detailRow}>
              <span>ID giao dịch:</span>
              <strong>{paymentLinkId}</strong>
            </div>
            <div className={styles.detailRow}>
              <span>Thời gian:</span>
              <strong>{new Date().toLocaleString('vi-VN')}</strong>
            </div>
          </div>
          <div className={styles.successFooter}>
            <p>🎉 Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!</p>
          </div>
        </div>
      )}

      {status === 'failed' && (
        <div className={styles.paymentFailed}>
          <div className={styles.errorIcon}>✗</div>
          <h2>❌ Thanh toán thất bại</h2>
          <p className={styles.errorMessage}>
            Giao dịch không thành công. Vui lòng thử lại hoặc liên hệ hỗ trợ.
          </p>
          <div className={styles.failedDetails}>
            <p><strong>Mã đơn:</strong> {orderCode}</p>
            <p><strong>Số tiền:</strong> {amount.toLocaleString('vi-VN')} VND</p>
          </div>
          <div className={styles.failedActions}>
            <button 
              onClick={() => window.location.reload()}
              className={styles.btnRetry}
            >
              🔄 Thử lại
            </button>
            {onCancel && (
              <button 
                onClick={onCancel}
                className={styles.btnCancel}
              >
                Hủy
              </button>
            )}
          </div>
        </div>
      )}

      {status === 'expired' && (
        <div className={styles.paymentExpired}>
          <div className={styles.warningIcon}>⏳</div>
          <h2>⏰ Giao dịch đã hết hạn</h2>
          <p>Thời gian thanh toán đã hết (15 phút). Đơn đặt sân sẽ được hủy tự động.</p>
          <button 
            onClick={onCancel}
            className={styles.btnNewQR}
          >
            Quay lại
          </button>
        </div>
      )}

      {status === 'cancelled' && (
        <div className={styles.paymentCancelled}>
          <div className={styles.cancelIcon}>⊘</div>
          <h2>Thanh toán đã bị hủy</h2>
          <p>Giao dịch đã bị hủy. Vui lòng thử lại nếu muốn tiếp tục.</p>
          <button 
            onClick={() => window.location.reload()}
            className={styles.btnRetry}
          >
            Quay lại
          </button>
        </div>
      )}
    </div>
  );
}

export default PayOSPayment;
