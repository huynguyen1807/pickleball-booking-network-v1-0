import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import styles from '../styles/Payment.module.css';

export default function PaymentResult() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'pending'>('loading');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const handlePaymentResult = async () => {
      try {
        const orderCode = searchParams.get('orderCode');
        const resultCode = searchParams.get('resultCode');
        const resultMessage = searchParams.get('resultMessage');

        console.log('[PayOS Return]', {
          orderCode,
          resultCode,
          resultMessage
        });

        if (!orderCode) {
          setStatus('failed');
          setError('Không tìm thấy mã đơn hàng');
          return;
        }

        // Query backend để lấy payment status
        try {
          const res = await axios.get(
            `/api/payments/payos-info/${orderCode}`,
            {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              }
            }
          );

          if (res.data.code === 0) {
            const payment = res.data.data;
            setPaymentData(payment);

            if (payment.status === 'completed') {
              setStatus('success');
            } else if (payment.status === 'failed') {
              setStatus('failed');
              setError('Thanh toán thất bại');
            } else if (payment.status === 'cancelled') {
              setStatus('failed');
              setError('Thanh toán đã bị hủy');
            } else {
              setStatus('pending');
            }
          } else {
            setStatus('pending');
            setError('Đang xử lý giao dịch, vui lòng chờ...');
          }
        } catch (err) {
          console.error('Error fetching payment info:', err);
          // Nếu backend error, kiểm tra qua URL params
          if (resultCode === '0') {
            setStatus('success');
          } else {
            setStatus('pending');
          }
        }
      } catch (err: any) {
        console.error('Payment result error:', err);
        setStatus('failed');
        setError(err.message || 'Lỗi xử lý kết quả thanh toán');
      }
    };

    handlePaymentResult();
  }, [searchParams]);

  // Auto-redirect after countdown
  useEffect(() => {
    if (status !== 'success' && status !== 'failed') return;

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    if (countdown === 0) {
      if (status === 'success') {
        navigate('/dashboard');
      } else {
        navigate('/booking');
      }
    }

    return () => clearInterval(timer);
  }, [countdown, status, navigate]);

  return (
    <div className={styles.paymentResultContainer}>
      {status === 'loading' && (
        <div className={styles.resultLoading}>
          <div className={styles.largeSpinner}></div>
          <h2>Đang xử lý kết quả thanh toán...</h2>
          <p>Vui lòng chờ trong giây lát</p>
        </div>
      )}

      {status === 'success' && (
        <div className={styles.resultSuccess}>
          <div className={styles.largeSuccessIcon}>✓</div>
          <h1>🎉 Thanh toán thành công!</h1>
          
          {paymentData && (
            <div className={styles.resultDetails}>
              <div className={styles.detailBox}>
                <div className={styles.detailItem}>
                  <span className={styles.label}>Mã đơn hàng:</span>
                  <span className={styles.value}>{paymentData.order_code}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.label}>Số tiền:</span>
                  <span className={`${styles.value} ${styles.highlight}`}>
                    {paymentData.amount.toLocaleString('vi-VN')} VND
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.label}>Hình thức:</span>
                  <span className={styles.value}>PayOS</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.label}>Trạng thái:</span>
                  <span className={`${styles.value} ${styles.statusSuccess}`}>
                    ✓ Thành công
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.label}>Thời gian:</span>
                  <span className={styles.value}>
                    {new Date(paymentData.created_at).toLocaleString('vi-VN')}
                  </span>
                </div>
              </div>
            </div>
          )}

          <p className={styles.successMessage}>
            Booking của bạn đã được xác nhận!<br/>
            Vui lòng kiểm tra email để nhận thông tin chi tiết.
          </p>

          <div className={styles.redirectMessage}>
            <p>Đang chuyển hướng tới dashboard trong {countdown} giây...</p>
          </div>

          <div className={styles.resultActions}>
            <button 
              onClick={() => navigate('/dashboard')}
              className={styles.btnPrimary}
            >
              📊 Về Dashboard
            </button>
            <button 
              onClick={() => navigate('/booking')}
              className={styles.btnSecondary}
            >
              📅 Đặt sân mới
            </button>
          </div>
        </div>
      )}

      {status === 'failed' && (
        <div className={styles.resultFailed}>
          <div className={styles.largeErrorIcon}>✗</div>
          <h1>❌ Thanh toán thất bại</h1>
          
          <p className={styles.errorMessage}>
            {error || 'Giao dịch không thành công. Vui lòng thử lại.'}
          </p>

          {paymentData && (
            <div className={styles.resultDetails}>
              <div className={styles.detailBox}>
                <div className={styles.detailItem}>
                  <span className={styles.label}>Mã đơn hàng:</span>
                  <span className={styles.value}>{paymentData.order_code}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.label}>Số tiền:</span>
                  <span className={styles.value}>
                    {paymentData.amount.toLocaleString('vi-VN')} VND
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className={styles.redirectMessage}>
            <p>Chuyển hướng tới trang đặt sân trong {countdown} giây...</p>
          </div>

          <div className={styles.resultActions}>
            <button 
              onClick={() => navigate('/booking')}
              className={styles.btnRetry}
            >
              🔄 Thử lại thanh toán
            </button>
            <button 
              onClick={() => navigate('/dashboard')}
              className={styles.btnSecondary}
            >
              📊 Về Dashboard
            </button>
          </div>
        </div>
      )}

      {status === 'pending' && (
        <div className={styles.resultPending}>
          <div className={styles.largeSpinner}></div>
          <h2>⏳ Đang xử lý giao dịch</h2>
          <p>Giao dịch của bạn đang được xử lý. Vui lòng chờ...</p>
          
          {paymentData && (
            <div className={styles.resultDetails}>
              <div className={styles.detailBox}>
                <div className={styles.detailItem}>
                  <span className={styles.label}>Trạng thái:</span>
                  <span className={`${styles.value} ${styles.statusPending}`}>
                    ⏳ Chờ xử lý
                  </span>
                </div>
              </div>
            </div>
          )}

          <p className={styles.pendingMessage}>
            Nếu giao dịch không được xác nhận sau 5 phút,<br/>
            vui lòng liên hệ bộ phận hỗ trợ.
          </p>

          <div className={styles.resultActions}>
            <button 
              onClick={() => window.location.reload()}
              className={styles.btnPrimary}
            >
              🔄 Kiểm tra lại
            </button>
            <button 
              onClick={() => navigate('/dashboard')}
              className={styles.btnSecondary}
            >
              📊 Về Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
