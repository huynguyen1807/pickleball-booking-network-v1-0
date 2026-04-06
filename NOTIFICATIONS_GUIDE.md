# 🔔 Hệ Thống Thông Báo (Notifications)

> **Hoàn thiện chức năng thông báo real-time cho Pickleball Booking Network**

---

## 📋 Tính Năng Được Thêm

### 1. **Thông báo Like (❤️)**
- **Khi nào**: Ai đó thích (like) bài viết của bạn
- **Nội dung**: `"[Username] đã thích bài viết của bạn"`
- **Click để**: Xem bài viết đó

### 2. **Thông báo Comment (💬)**
- **Khi nào**: Ai đó comment trên bài viết của bạn
- **Nội dung**: `"[Username]: '[Preview text...]'"`
- **Click để**: Xem bài viết và comment

### 3. **Thông báo Share (🔗)**
- **Khi nào**: Ai đó chia sẻ bài viết của bạn
- **Nội dung**: `"[Username] đã chia sẻ bài viết của bạn"`
- **Click để**: Xem bài viết

### 4. **Thông báo Join Match (✅)** - **MỚI** 🎉
- **Khi nào**: Ai đó tham gia ghép trận của bạn hoặc bạn join vào trận ai khác
- **Nội dung**: 
  - Nếu còn chỗ: `"[Username] đã tham gia trận (2/4)"`
  - Nếu chờ xếp hàng: `"[Username] chờ xếp hàng cho trận #123"`
- **Click để**: Xem chi tiết trận

### 5. **Thông báo Booking Confirmed (🎫)** - **MỚI** 🎉
- **Khi nào**: Thanh toán đặt sân thành công
- **Nội dung**: `"Đã xác nhận đơn đặt sân 'Sân 1' ngày [DATE] lúc [TIME]"`
- **Click để**: Xem chi tiết booking

### 6. **Thông báo Match Payment Confirmed (💰)** - **MỚI** 🎉
- **Khi nào**: Thanh toán ghép trận thành công
- **Nội dung**: `"Thanh toán ghép trận 'Sân 1' ngày [DATE] lúc [TIME] - Sẵn sàng chơi!"`
- **Click để**: Xem chi tiết trận

---

## 👑 THÔNG BÁO CHO CHỦSÂN (COURT OWNER NOTIFICATIONS) - **MỚI**

### 1. **Thông báo Match Mới Trên Sân (🎯)**
- **Khi nào**: Có người tạo/ghép trận sử dụng sân của bạn
- **Nội dung**: `"🎯 Có trận ghép mới trên sân: Trận [format] tại '[Court Name]' ([Facility Name]) - [DATE] lúc [TIME]"`
- **Click để**: Xem chi tiết trận

### 2. **Thông báo Thanh Toán Đặt Sân (💵)**
- **Khi nào**: Ai đó thanh toán thành công đặt sân của bạn
- **Nội dung**: `"💵 Có thanh toán đặt sân: [Player Name] thanh toán cho '[Court Name]' - [DATE] lúc [TIME]"`
- **Click để**: Xem chi tiết booking

### 3. **Thông báo Thanh Toán Ghép Trận (💰)**
- **Khi nào**: Ai đó thanh toán thành công ghép trận trên sân của bạn
- **Nội dung**: `"💰 Có thanh toán ghép trận: Trận tại '[Court Name]' - [DATE] lúc [TIME] ([Player Name] thanh toán)"`
- **Click để**: Xem chi tiết trận

### 4. **Thông báo Like/Comment/Share Bài Viết Của Bạn (❤️ 💬 🔗)**
- **Khi nào**: Có sự tương tác trên bài viết của bạn
- **Nội dung**:
  - Like: `"[Username] đã thích bài viết của bạn"`
  - Comment: `"[Username]: '[Preview text...]'"`
  - Share: `"[Username] đã chia sẻ bài viết của bạn"`
- **Click để**: Xem bài viết

## 🎨 Giao Diện Notification

### Dropdown Thông Báo (Navbar)
```
位置: Góc trên cùng navbar, bên cạnh profile
- Hiển thị biểu tượng chuông 🔔 với badge số chưa đọc
- Click để mở dropdown
- Hiển thị 10 thông báo mới nhất
- "Đánh dấu tất cả đã đọc" button
- Link "Xem tất cả thông báo →"
```

### Trang Thông Báo Đầy Đủ (`/notifications`)
```
- Tiêu đề: "🔔 Thông báo"
- Tabs: "Tất cả (X)" | "Chưa đọc (Y)"
- Danh sách tất cả thông báo (limit 50)
- Với mỗi thông báo:
  - Icon emoji (❤️ 💬 🔗 ✅ 💰 🎫)
  - Tiêu đề & nội dung message
  - Thời gian (e.g., "5m trước", "2h trước")
  - Button "✓" để đánh dấu đã đọc
  - Button "✕" để xóa
  - Dấu chấm xanh nếu chưa đọc
```

---

## 🔧 Cách Hoạt Động (Technical Details)

### Backend Flow

#### 1. **Khi User Like Post**
```typescript
// post.controller.ts - likePost()
- Check user không thích post này rồi
- INSERT vào post_likes table
- Emit Socket.io: 'post_liked' (broadcast cập nhật count)
- createNotification(postOwnerId, "❤️ Thích mới", message, "like", postId)
- Emit Socket.io: 'new_notification' → post owner
```

#### 2. **Khi User Comment Post**
```typescript
// post.controller.ts - addComment()
- Validate comment content
- INSERT vào comments table
- Emit Socket.io: 'post_commented' (broadcast mới comment)
- createNotification(postOwnerId, "💬 Bình luận mới", message, "comment", postId)
- Emit Socket.io: 'new_notification' → post owner
```

#### 3. **Khi User Join Match** 
```typescript
// match.controller.ts - joinMatch()
- Check user không đã join match này
- INSERT vào match_players với status='joined' hoặc 'waitlist'
- Cập nhật match.current_players
- createNotification(creatorId, "✅ Có người tham gia/chờ", message, "match_join", matchId)
- Emit Socket.io: 'new_notification' → match creator
```

#### 4. **Khi User Create Match (NEW - Owner Notification)**
```typescript
// match.controller.ts - createMatch()
- Insert new match record
- Create chat room for match
- **Query facility owner**: SELECT f.owner_id, f.name, c.name FROM courts c 
  JOIN facilities f ON c.facility_id = f.id WHERE c.id = @court_id
- **If creator is NOT owner**:
  - createNotification(owner_id, "🎯 Có trận ghép mới trên sân", 
    message with court/facility name and match date/time, "match_created", matchId)
  - Emit Socket.io: 'new_notification' → court owner
```

#### 5. **Khi Payment Success - Booking (Updated - Owner Notification)**
```typescript
// payment.controller.ts - payosWebhook()
- PayOS gửi webhook thông báo payment 'completed'
- updatePaymentStatus(paymentId, 'completed')

// Nếu booking:
- Query booking info including facility owner:
  SELECT c.name, b.booking_date, start_time, f.owner_id, u.full_name 
  FROM bookings b JOIN courts c ON b.court_id = c.id 
  JOIN facilities f ON c.facility_id = f.id 
  JOIN users u ON b.user_id = u.id
  
- updateBookings status → 'confirmed'
- createNotification(userId, "✅ Đặt sân thành công", message, "booking_confirmed", bookingId)
- **If payer is NOT owner**:
  - createNotification(owner_id, "💵 Có thanh toán đặt sân", 
    "[Player Name] thanh toán cho '[Court Name]'...", "booking_payment", bookingId)
  - Emit Socket.io: 'new_notification' → court owner

- Emit Socket.io: 'new_notification' → user
```

#### 6. **Khi Payment Success - Match (NEW - Owner Notification)**
```typescript
// payment.controller.ts - payosWebhook()
- PayOS gửi webhook thông báo payment 'completed'

// Nếu match:
- Query match info including facility owner:
  SELECT c.name, m.match_date, start_time, f.owner_id, u.full_name 
  FROM matches m JOIN courts c ON m.court_id = c.id 
  JOIN facilities f ON c.facility_id = f.id 
  JOIN users u ON m.creator_id = u.id
  
- syncMatchPaymentState(paymentRecord, 'completed')
- createNotification(userId, "✅ Thanh toán ghép trận thành công", 
  message with match date/time, "match_payment_confirmed", matchId)
- **If payer is NOT creator/owner**:
  - Query payer name: SELECT full_name FROM users WHERE id = @payer_id
  - createNotification(owner_id, "💰 Có thanh toán ghép trận", 
    message with court name, match date/time, and payer name, "match_payment_owner", matchId)
  - Emit Socket.io: 'new_notification' → court owner
```

### Frontend Flow

#### 1. **NotificationDropdown Component**
```typescript
- Load notifications khi mount: api.get('/notifications')
- Subscribe tới Socket.io 'new_notification' event
- **[NEW]** Click notification → handleNotificationClick()
  - Mark as read (if not read)
  - Close dropdown
  - Navigate to appropriate page based on type
- markAsRead(), markAllAsRead(), deleteNotification()
```

#### 2. **Notifications Full Page**
```typescript
- Tương tự dropdown nhưng full-page + filter by unread
- Hiển thị 50 notifications (pagination có thể add sau)
- **[NEW]** Click notification → handleNotificationClick()
  - Mark as read
  - Navigate to appropriate page
- Responsive design cho mobile
```

#### 3. **Navigation Logic** (NEW)
```typescript
// When user clicks notification:
switch (type) {
  case 'like' | 'comment' | 'share':
    navigate("/") // Posts shown on home feed
    
  case 'match_join' | 'match_created' | 'match_payment_confirmed' | 'match_payment_owner':
    navigate(`/matches/${reference_id}`) // Go to match detail
    
  case 'booking_confirmed' | 'booking_payment':
    navigate(`/booking/${reference_id}`) // Go to booking detail
}
```

#### 4. **Socket.io Connection**
```typescript
// NotificationDropdown.tsx
socket.on('connect', () => {
  socket.emit('join_notifications', user.id)
})
socket.on('new_notification', () => {
  loadNotifications() // reload notifications list
})
```

---

## 📱 How to Use (User Guide)

### 👤 Nhận Thông Báo
1. **Các bài viết của bạn**:
   - Khi ai like → Nhận thông báo ❤️
   - Khi ai comment → Nhận thông báo 💬
   - Khi ai share → Nhận thông báo 🔗

2. **Ghép trận của bạn**:
   - Khi ai join → Nhận thông báo ✅
   - Khi họ thanh toán xong → Nhận thông báo 💰

3. **Đặt sân**:
   - Khi thanh toán xong → Nhận thông báo 🎫

### 🔔 Xem Thông Báo
- **Quick**: Click biểu tượng chuông ở navbar → Dropdown
- **Full**: Click "Xem tất cả thông báo" hoặc vào `/notifications`
- **Lọc**: Tabs "Tất cả" | "Chưa đọc" trên trang `/notifications`

### ✨ Nhấp Vào Thông Báo (NEW!)
- **Tự động điều hướng**: Nhấp bất kỳ thông báo nào sẽ đưa bạn đến nơi xuất hiện thông báo:
  - ❤️/💬/🔗 **Like/Comment/Share** → Đi tới trang chủ (Home) xem bài viết
  - ✅/🎯/💰 **Match notifications** → Đi tới chi tiết trận (Match Detail)  
  - 🎫/💵 **Booking notifications** → Đi tới chi tiết booking (Booking Detail)
- **Tự động đánh dấu**: Thông báo chưa đọc sẽ tự động được đánh dấu đã đọc khi bạn nhấp vào

### ✓ Quản Lý Thông Báo
- **Đánh dấu đã đọc**: Click thông báo hoặc button ✓
- **Đánh dấu tất cả**: Button "Đánh dấu tất cả đã đọc"
- **Xóa**: Click button ✕

---

## 🗄️ Database Schema

### notifications table
```sql
CREATE TABLE notifications (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE,
  title NVARCHAR(200) NOT NULL,
  message NVARCHAR(MAX),
  type NVARCHAR(50),    -- 'like'|'comment'|'share'|'match_join'|'booking_confirmed'|'match_payment_confirmed'
                        -- |'match_created'|'booking_payment'|'match_payment_owner'
  reference_id INT,     -- postId, matchId, or bookingId
  is_read BIT DEFAULT 0,
  created_at DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
);
```

### Notification Types & Icons

| Type | Icon | Description |
|------|------|-------------|
| `like` | ❤️ | User liked your post |
| `comment` | 💬 | User commented on your post |
| `share` | 🔗 | User shared your post |
| `match_join` | ✅ | User joined your match |
| `booking_confirmed` | 🎫 | Your booking payment confirmed |
| `match_payment_confirmed` | 💰 | Your match payment confirmed |
| `match_created` | 🎯 | New match created on your court |
| `booking_payment` | 💵 | User paid for booking on your court |
| `match_payment_owner` | 💰 | User paid for match on your court |

---

## 🚀 API Routes

### Notifications API
```
GET  /api/notifications           - Lấy danh sách notifications (50 mới nhất)
GET  /api/notifications/unread-count - Lấy số chưa đọc
PUT  /api/notifications/:id/read  - Đánh dấu 1 cái đã đọc
PUT  /api/notifications/read-all  - Đánh dấu tất cả đã đọc
```

---

## 🎯 Feature Checklist

- ✅ Thông báo like post
- ✅ Thông báo comment post
- ✅ Thông báo share post
- ✅ Thông báo join match
- ✅ Thông báo payment success (booking)
- ✅ Thông báo payment success (match)
- ✅ **[NEW]** Thông báo match mới trên sân chủ sở hữu
- ✅ **[NEW]** Thông báo thanh toán đặt sân cho chủ sở hữu
- ✅ **[NEW]** Thông báo thanh toán ghép trận cho chủ sở hữu
- ✅ **[NEW]** Thông báo like/comment/share bài viết của chủ sở hữu
- ✅ Real-time updates via Socket.io
- ✅ Dropdown thông báo ở navbar
- ✅ Full notifications page (`/notifications`)
- ✅ Mark as read / read all
- ✅ Filter by unread
- ✅ Responsive design
- ✅ Beautiful UI với emojis

---

## 🔮 Future Enhancements

- [ ] Push notifications (browser push API)
- [ ] Email notifications option
- [ ] Notification sound/vibration
- [ ] Notification preferences (per type)
- [ ] Pagination + infinite scroll
- [ ] Search notifications
- [ ] Archive notifications
- [ ] Notification history (more than 50)

---

## ⚡ Installation & Testing

### 1. Backend Ready
Database schema đã có `notifications` table ✅
Controllers đã có `createNotification()` ✅
Routes đã có GET/PUT endpoints ✅

### 2. Frontend Ready
Components: `NotificationDropdown.tsx` ✅
Pages: `Notifications.tsx` ✅
Routes thêm `/notifications` ✅
Socket.io integrated ✅

### 3. Testing Steps
1. Open app → Login
2. Create a post
3. Open another user → Like/Comment post
4. Check notifications dropdown → Notification should appear
5. Create a match
6. Join match as another user → Notification should appear
7. Complete payment → Notification should appear
8. Visit `/notifications` → Full page

---

## 🆘 Troubleshooting

**Q: Notification không hiện?**
- A: Check XÃ browser console for errors
- Check server logs: `console.log()` in createNotification()
- Make sure Socket.io connected: `socket.io connected` log

**Q: Real-time update không work?**
- A: Check Socket.io URL hợp lệ
- Check user.id được pass đúng
- Check backend `getIO()` initialized

**Q: Dropdown không show?**
- A: Check NotificationDropdown component import ở Navbar
- Clear browser cache (Ctrl+Shift+Delete)
- Check no console errors

---

## 📞 Support

Liên hệ: [Dev Team]

---

**Last Updated**: March 20, 2026
**Version**: 1.0
