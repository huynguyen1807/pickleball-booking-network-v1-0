import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import styles from '../styles/Payment.module.css';

interface PayOSPaymentProps {
  checkoutUrl: string;
  qrCode: string;
  orderCode: number;
  paymentLinkId: string;
  amount: number;
  onSuccess: () => void;
  onCancel?: () => void;
}

export function PayOSPayment({
  checkoutUrl,
  qrCode,
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
  const [pollingCount, setPollingCount] = useState(0);

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

  // Auto-open checkout URL in new tab
  useEffect(() => {
    if (checkoutUrl && status === 'pending') {
      // Mở tab PayOS tự động khi component mount
      window.open(checkoutUrl, '_blank');
    }
  }, [checkoutUrl, status]);

  // Poll payment status
  useEffect(() => {
    if (!polling || status !== 'pending') return;

    const pollInterval = setInterval(async () => {
      try {
        // Poll backend for payment status
        const res = await api.get(
          `/payments/payos-status/${orderCode}`
        );

        setPollingCount(prev => prev + 1);
        console.log(`[PayOS Poll #${pollingCount + 1}]`, res.data);

        if (res.data.status === 'completed') {
          setStatus('completed');
          setPolling(false);
          // Delay thêm 2s để ensure webhook processed
          setTimeout(() => {
            onSuccess();
          }, 2000);
        } else if (res.data.status === 'failed') {
          setStatus('failed');
          setPolling(false);
        } else if (res.data.status === 'cancelled') {
          setStatus('cancelled');
          setPolling(false);
        }
      } catch (err) {
        console.error('Poll error:', err);
        // Continue polling despite errors
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [orderCode, polling, status, onSuccess, pollingCount]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRedirectToPayOS = () => {
    window.open(checkoutUrl, '_blank');
  };

  const handleCopyQRCode = () => {
    // Copy QR code image to clipboard
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          navigator.clipboard.write([
            new ClipboardItem({ [blob.type]: blob })
          ]).then(() => {
            alert('Mã QR đã copy vào clipboard');
          });
        }
      });
    };
    img.src = qrCode;
  };

  return (
    <div className={styles.payosPaymentContainer}>
      {status === 'pending' && (
        <div className={styles.paymentPending}>
          <h2>PayOS - Quét mã QR để thanh toán</h2>

          {/* QR Code Display */}
          <div className={styles.qrSection}>
            <img
              src={qrCode}
              alt="QR Code PayOS"
              className={styles.qrCode}
            />
            <button 
              onClick={handleCopyQRCode}
              className={styles.btnCopyQR}
            >
              📋 Copy QR Code
            </button>
          </div>

          {/* Amount Display */}
          <div className={styles.amountSection}>
            <p>Số tiền thanh toán</p>
            <h3>{amount.toLocaleString('vi-VN')} VND</h3>
            <p className={styles.orderInfo}>
              Mã đơn: <strong>{orderCode}</strong>
            </p>
          </div>

          {/* Timer */}
          <div className={styles.timerSection}>
            <p>Mã QR hết hạn trong:</p>
            <span className={styles.timer}>{formatTime(timeLeft)}</span>
            {timeLeft < 60 && (
              <p className={styles.warning}>
                ⚠️ Mã QR sắp hết hạn, vui lòng thanh toán ngay
              </p>
            )}
          </div>

          {/* Instructions */}
          <div className={styles.instructions}>
            <h4>📱 Hướng dẫn thanh toán:</h4>
            <ol>
              <li>Mở ứng dụng ngân hàng của bạn</li>
              <li>Chọn "Quét QR" hoặc "Chuyển tiền"</li>
              <li>Quét mã QR trên màn hình này</li>
              <li>Nhập mã PIN/OTP xác nhận</li>
              <li>Thanh toán thành công</li>
            </ol>
          </div>

          {/* Alternative: Redirect Button */}
          <button 
            onClick={handleRedirectToPayOS}
            className={styles.btnPayosCheckout}
          >
            💳 Thanh toán trực tiếp (mở tab mới)
          </button>

          {/* Status Indicator */}
          <div className={styles.statusIndicator}>
            <div className={styles.spinnerSmall}></div>
            <span>Đang chờ thanh toán...</span>
            {pollingCount > 0 && (
              <span className={styles.pollCount}>(poll #{pollingCount})</span>
            )}
          </div>
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
          <h2>⏰ Mã QR hết hạn</h2>
          <p>Mã QR của bạn đã hết hạn. Vui lòng tạo mã mới để tiếp tục thanh toán.</p>
          <button 
            onClick={() => window.location.reload()}
            className={styles.btnNewQR}
          >
            🔄 Tạo mã QR mới
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
