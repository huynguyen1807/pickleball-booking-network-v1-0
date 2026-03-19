# 📝 Báo cáo Chi tiết: Module Owner & Booking

Tài liệu này liệt kê **toàn bộ** các file code thuộc phần bài làm của tôi (Owner & Booking) và giải thích chi tiết logic xử lý. Bạn có thể **Ctrl + Click** vào tên file bên dưới để mở trực tiếp trong IDE.

---

## 📂 1. Danh sách đầy đủ các File đảm nhiệm

### 📱 A. Frontend (Giao diện & Logic người dùng)

**1. Module Owner (Dành cho Chủ sân):**
*   [OwnerDashboard.tsx](file:///d:/6.OJT/pickleball-booking-network-v1.0/client/src/pages/OwnerDashboard.tsx): Bảng điều khiển thống kê doanh thu, lượt đặt sân.
*   [OwnerCourts.tsx](file:///d:/6.OJT/pickleball-booking-network-v1.0/client/src/pages/OwnerCourts.tsx): Quản lý danh sách các Cơ sở và Sân con.
*   [OwnerCourtDetail.tsx](file:///d:/6.OJT/pickleball-booking-network-v1.0/client/src/pages/OwnerCourtDetail.tsx): Chi tiết từng cụm sân, quản lý trạng thái hoạt động.
*   [OwnerCreateFacility.tsx](file:///d:/6.OJT/pickleball-booking-network-v1.0/client/src/pages/OwnerCreateFacility.tsx): Form tạo mới cơ sở Pickleball.
*   [OwnerCreateCourt.tsx](file:///d:/6.OJT/pickleball-booking-network-v1.0/client/src/pages/OwnerCreateCourt.tsx): Form thêm mới sân con vào cơ sở.
*   [SubCourtForm.tsx](file:///d:/6.OJT/pickleball-booking-network-v1.0/client/src/components/SubCourtForm.tsx): Form cấu hình chi tiết (Giá, giờ vàng, bước nhảy thời gian).
*   [Dashboard.module.css](file:///d:/6.OJT/pickleball-booking-network-v1.0/client/src/styles/Dashboard.module.css): Giao diện quản lý chuyên nghiệp cho chủ sân.

**2. Module Booking (Quy trình đặt sân):**
*   [Courts.tsx](file:///d:/6.OJT/pickleball-booking-network-v1.0/client/src/pages/Courts.tsx): Tìm kiếm, lọc sân theo giá, độ phổ biến.
*   [CourtDetail.tsx](file:///d:/6.OJT/pickleball-booking-network-v1.0/client/src/pages/CourtDetail.tsx): Hiển thị lịch sân, chọn ngày và **chọn Slot khả dụng**.
*   [Booking.tsx](file:///d:/6.OJT/pickleball-booking-network-v1.0/client/src/pages/Booking.tsx): Trang xác nhận thông tin cuối cùng và thanh toán.
*   [Booking.module.css](file:///d:/6.OJT/pickleball-booking-network-v1.0/client/src/styles/Booking.module.css) & [Courts.module.css](file:///d:/6.OJT/pickleball-booking-network-v1.0/client/src/styles/Courts.module.css): Styling cho quy trình đặt sân mượt mà.

---

### ⚙️ B. Backend (Xử lý nghiệp vụ & Database)

**1. Controllers (Xử lý logic chính):**
*   [booking.controller.ts](file:///d:/6.OJT/pickleball-booking-network-v1.0/sever/controllers/booking.controller.ts): Tạo booking, tính giá, chống đặt trùng bằng SQL Transaction.
*   [court.controller.ts](file:///d:/6.OJT/pickleball-booking-network-v1.0/sever/controllers/court.controller.ts): Lấy thông tin sân và thuật toán sinh slot động (getCourtSlots).
*   [facility.controller.ts](file:///d:/6.OJT/pickleball-booking-network-v1.0/sever/controllers/facility.controller.ts): Xử lý thêm/sửa/xóa cơ sở của chủ sân.
*   [stats.controller.ts](file:///d:/6.OJT/pickleball-booking-network-v1.0/sever/controllers/stats.controller.ts): Xuất dữ liệu báo cáo doanh thu cho Dashboard.

**2. Routes (Định nghĩa API):**
*   [booking.routes.ts](file:///d:/6.OJT/pickleball-booking-network-v1.0/sever/routes/booking.routes.ts)
*   [court.routes.ts](file:///d:/6.OJT/pickleball-booking-network-v1.0/sever/routes/court.routes.ts)
*   [facility.routes.ts](file:///d:/6.OJT/pickleball-booking-network-v1.0/sever/routes/facility.routes.ts)
*   [stats.routes.ts](file:///d:/6.OJT/pickleball-booking-network-v1.0/sever/routes/stats.routes.ts)

**3. Middleware (Bảo mật & Phân quyền):**
*   [auth.ts](file:///d:/6.OJT/pickleball-booking-network-v1.0/sever/middleware/auth.ts): Bảo mật JWT, đảm bảo người dùng phải đăng nhập.
*   [role.ts](file:///d:/6.OJT/pickleball-booking-network-v1.0/sever/middleware/role.ts): Đảm bảo chỉ người có quyền `owner` mới được vào trang quản lý sân.

---

## 🔍 2. Giải thích chi tiết các Logic "Xương sống"

### 🟢 Chống đặt trùng (Race Condition)
Trong file [booking.controller.ts](file:///d:/6.OJT/pickleball-booking-network-v1.0/sever/controllers/booking.controller.ts), tôi đã sử dụng kỹ thuật khóa dòng dữ liệu (`UPDLOCK, HOLDLOCK`) trong một Transaction. Điều này cực kỳ quan trọng: Nó đảm bảo tại một thời điểm, chỉ một người có thể xác nhận đặt slot đó thành công, ngăn chặn lỗi hệ thống khi có quá nhiều người đặt cùng lúc.

### 🟢 Thuật toán sinh Slot động
Thay vì lưu hàng triệu slot vào DB, tôi viết logic trong [court.controller.ts](file:///d:/6.OJT/pickleball-booking-network-v1.0/sever/controllers/court.controller.ts) để tự động tính toán slot dựa trên giờ mở cửa của sân. Hệ thống sẽ tự kiểm tra xem giờ đó đã có ai đặt chưa và giờ đó đã trôi qua chưa để hiển thị màu xanh (khả dụng) hoặc màu đỏ (không khả dụng).

### 🟢 Tính toán giá thông minh
Hệ thống xử lý tách biệt thời gian: Nếu khách đặt vắt ngang khung giờ vàng (VD: 16h-18h mà giờ vàng là 17h-20h), hệ thống sẽ tự tính 1 tiếng giá thường + 1 tiếng giá vàng. Điều này đảm bảo minh bạch tuyệt đối về tài chính.

---

## 🏆 3. Kết luận
Trên đây là **tất cả** các file và logic mà tôi đảm nhiệm. Hệ thống này giải quyết được các bài toán khó về **đồng bộ dữ liệu**, **bảo mật** và **tối ưu trải nghiệm người dùng**.
