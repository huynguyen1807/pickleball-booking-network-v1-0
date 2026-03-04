# 🎾 Pickleball Booking Network - Complete Setup Guide

> **Comprehensive guide for developers** to setup the project from scratch after cloning the repository.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Prerequisites](#prerequisites)
3. [Installation Steps](#installation-steps)
4. [Database Setup](#database-setup)
5. [Environment Configuration](#environment-configuration)
6. [PayOS Payment Gateway Setup](#payos-payment-gateway-setup)
7. [Running the Application](#running-the-application)
8. [Testing Payment Flow](#testing-payment-flow)
9. [Troubleshooting](#troubleshooting)
10. [Project Structure](#project-structure)

---

## 🎯 Project Overview

**Pickleball Booking Network** is a full-stack TypeScript application for managing pickleball court bookings with integrated payment processing.

### Tech Stack

**Frontend:**
- React 18.2 + TypeScript 5.0
- Vite (development server)
- React Router 6 (navigation)
- Axios (API client with interceptors)
- CSS Modules (styling)

**Backend:**
- Node.js + Express.js 4.18
- TypeScript 5.9
- SQL Server (database)
- JWT Authentication
- Socket.io (real-time chat)

**Payment Gateway:**
- PayOS API v2
- HMAC SHA256 signature verification
- Napas 24/7 inter-bank network

**Development Tools:**
- Ngrok (webhook tunneling for local development)
- Nodemon (auto-restart backend)
- ESLint + Prettier

---

## ✅ Prerequisites

Before starting, ensure you have these installed:

### Required Software

| Software | Version | Download Link | Purpose |
|----------|---------|---------------|---------|
| **Node.js** | 18.x or 20.x | https://nodejs.org | Runtime environment |
| **npm** | 9.x or 10.x | (included with Node.js) | Package manager |
| **SQL Server** | 2019+ or Express | https://microsoft.com/sql | Database |
| **Git** | Latest | https://git-scm.com | Version control |
| **Ngrok** | Latest | https://ngrok.com | Webhook tunneling |

### Optional but Recommended

- **SQL Server Management Studio (SSMS)** - GUI for database management
- **Visual Studio Code** - Code editor with TypeScript support
- **Postman** - API testing

### Account Requirements

1. **PayOS Merchant Account** (for payment processing)
   - Sign up at: https://my.payos.vn/signup
   - Verify business/personal information
   - Get API credentials (Client ID, API Key, Checksum Key)

2. **Ngrok Account** (for webhook testing)
   - Sign up at: https://dashboard.ngrok.com/signup
   - Get authentication token
   - Configure domain (optional but recommended)

---

## 📥 Installation Steps

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd pickleball-booking-network-v1.0
```

### Step 2: Install Backend Dependencies

```bash
cd sever
npm install
```

**Expected packages** (~50 dependencies):
- express, cors, dotenv, jsonwebtoken
- mssql (SQL Server driver)
- socket.io (WebSocket)
- axios (PayOS API client)
- bcryptjs (password hashing)
- nodemailer (email notifications)

### Step 3: Install Frontend Dependencies

```bash
cd ../client
npm install
```

**Expected packages** (~30 dependencies):
- react, react-dom, react-router-dom
- axios (API calls)
- vite (build tool)
- typescript

### Step 4: Verify Installation

Check that both installs completed successfully:

```bash
# In sever folder
npm list --depth=0

# In client folder
npm list --depth=0
```

---

## 🗄️ Database Setup

### Step 1: Start SQL Server

Ensure SQL Server is running:

**Windows (SQL Server Express):**
```powershell
# Check status
Get-Service MSSQL*

# Start service if stopped
Start-Service MSSQL$SQLEXPRESS
```

**Alternative: Check via SSMS**
- Open SQL Server Management Studio
- Connect to `localhost` or `localhost\SQLEXPRESS`

### Step 2: Create Database

```sql
-- Connect to SQL Server using SSMS or sqlcmd
CREATE DATABASE pickleball_danang;
GO

USE pickleball_danang;
GO
```

### Step 3: Run Schema Migration

Execute the schema file to create all tables:

**Option A: Using SSMS**
1. Open `sever/database/schema.sql`
2. Execute the script (F5)

**Option B: Using sqlcmd**
```bash
cd sever/database
sqlcmd -S localhost -U sa -P your_password -d pickleball_danang -i schema.sql
```

### Step 4: Add transaction_id Column (Payment Enhancement)

```bash
sqlcmd -S localhost -U sa -P your_password -d pickleball_danang -i add-transaction-id.sql
```

**This migration adds:**
- `transaction_id` column (NVARCHAR(100), UNIQUE, nullable)
- Filtered unique index for idempotency
- Format: `payos_{orderCode}_{paymentLinkId}`

### Step 5: Verify Database Setup

```sql
-- Check tables
SELECT name FROM sys.tables ORDER BY name;

-- Expected tables (12 total):
-- bookings, chats, comments, courts, court_schedules, 
-- matches, messages, notifications, payments, posts, users, user_roles

-- Check payments table structure
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'payments';

-- Should include: transaction_id (nvarchar, yes)
```

---

## ⚙️ Environment Configuration

### Backend Configuration

Create `.env` file in `sever/` folder:

```bash
cd sever
cp .env.example .env  # or manually create
```

**Complete `.env` template:**

```env
# Server Configuration
PORT=5000

# Database Configuration
DB_SERVER=localhost
# DB_SERVER=localhost\SQLEXPRESS  # Use this for SQL Server Express
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=your_sql_password_here
DB_NAME=pickleball_danang

# JWT Authentication
JWT_SECRET=pickleball_danang_secret_key_2026_change_this_in_production
JWT_EXPIRES_IN=7d

# Business Logic
COMMISSION_RATE=0.05

# Email SMTP (Optional - for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_FROM="PickleBall Đà Nẵng" <your_email@gmail.com>

# PayOS Payment Gateway
PAYOS_CLIENT_ID=your_client_id_from_payos
PAYOS_API_KEY=your_api_key_from_payos
PAYOS_CHECKSUM_KEY=your_checksum_key_from_payos
PAYOS_API_URL=https://api-merchant.payos.vn

# PayOS Return URLs (Frontend)
PAYOS_RETURN_URL=http://localhost:5173/payment/result
PAYOS_CANCEL_URL=http://localhost:5173/payment/cancel

# PayOS Webhook URL (Backend - requires ngrok for local dev)
PAYOS_WEBHOOK_URL=https://your-ngrok-subdomain.ngrok-free.app/api/payments/payos-webhook
```

**⚠️ Critical Configuration Notes:**

1. **DB_PASSWORD**: Use your actual SQL Server `sa` password
2. **JWT_SECRET**: Change this in production (use strong random string)
3. **PayOS credentials**: Get from https://my.payos.vn/profile → API Keys
4. **PAYOS_WEBHOOK_URL**: Will be updated after ngrok setup (see next section)

### Frontend Configuration

Frontend configuration is minimal (uses Vite proxy):

**File**: `client/vite.config.ts`

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
```

No `.env` needed for client. Backend URL is proxied automatically.

---

## 💳 PayOS Payment Gateway Setup

### Step 1: Create PayOS Account

1. Go to https://my.payos.vn/signup
2. Register business/personal account
3. Complete KYC verification (may take 1-2 days for approval)

### Step 2: Get API Credentials

**Dashboard Navigation:**
```
Login → Settings → API Integration → Copy credentials
```

You need these 3 values:
- **Client ID**: UUID format (e.g., `2fdd2cc8-1dc6-4cfb-...`)
- **API Key**: UUID format (e.g., `5b7f931a-4bce-...`)
- **Checksum Key**: 64-character hex string

**Copy these into your `sever/.env` file.**

### Step 3: Configure Webhook URL (Using Ngrok)

PayOS needs to send payment status updates to your backend. For local development, use ngrok to expose localhost:5000.

**Install Ngrok:**
```bash
# Download from https://ngrok.com/download
# Or install via package manager:

# Windows (Chocolatey)
choco install ngrok

# macOS (Homebrew)
brew install ngrok/ngrok/ngrok

# Verify installation
ngrok version
```

**Authenticate Ngrok:**
```bash
ngrok config add-authtoken YOUR_NGROK_AUTH_TOKEN
```
Get your token from: https://dashboard.ngrok.com/get-started/your-authtoken

**Start Ngrok Tunnel:**
```bash
# Run in a separate terminal (keep it running)
ngrok http 5000

# You'll see output like:
# Forwarding: https://abc123xyz.ngrok-free.app -> http://localhost:5000
```

**Copy the HTTPS URL** (e.g., `https://abc123xyz.ngrok-free.app`)

**Update `.env`:**
```env
PAYOS_WEBHOOK_URL=https://abc123xyz.ngrok-free.app/api/payments/payos-webhook
```

### Step 4: Register Webhook in PayOS Dashboard

1. Login to https://my.payos.vn
2. Go to **Settings** → **Webhook Configuration**
3. Enter webhook URL: `https://your-ngrok-url.ngrok-free.app/api/payments/payos-webhook`
4. Click **Test Webhook** to verify connection
5. Save configuration

**✅ Success indicators:**
- Test webhook returns status 200
- PayOS shows "Webhook active" green status

---

## 🚀 Running the Application

### Terminal Setup (3 terminals required)

#### Terminal 1: Backend Server

```bash
cd sever
npm run dev
```

**Expected output:**
```
[nodemon] starting `node --loader ts-node/esm index.ts`
✅ SQL Server connected
✅ Server running on http://localhost:5000
✅ Socket.io initialized
```

**If you see errors**, check [Troubleshooting](#troubleshooting) section.

#### Terminal 2: Frontend Development Server

```bash
cd client
npm run dev
```

**Expected output:**
```
VITE v5.x.x  ready in 500 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

#### Terminal 3: Ngrok Tunnel (for PayOS webhooks)

```bash
ngrok http 5000
```

**Expected output:**
```
Session Status: online
Account: your_account (Plan: Free)
Forwarding: https://abc-xyz.ngrok-free.app -> http://localhost:5000
```

**⚠️ Important Notes:**

1. **Terminal 1 & 2** must stay running during development
2. **Terminal 3** (ngrok) must stay running for payment webhooks to work
3. If ngrok URL changes after restart, update `.env` PAYOS_WEBHOOK_URL and PayOS dashboard
4. Backend must restart after `.env` changes: `Ctrl+C` then `npm run dev`

### Verification Checklist

- [ ] Backend: http://localhost:5000/api/health returns `{"status":"ok"}`
- [ ] Frontend: http://localhost:5173 loads the homepage
- [ ] Ngrok: https://your-url.ngrok-free.app/api/health returns `{"status":"ok"}`
- [ ] Database: Can query `SELECT * FROM users` successfully

---

## 🧪 Testing Payment Flow

### End-to-End Payment Test

**Prerequisites:**
- All 3 terminals running (backend, frontend, ngrok)
- PayOS webhook configured
- Database has sample courts

### Test Scenario: Create Booking with PayOS Payment

**Step 1: Create Test User**
```bash
# Open frontend: http://localhost:5173
# Click "Đăng ký" (Register)
# Fill form:
- Username: testuser
- Email: test@example.com
- Password: Test123456
- Phone: 0901234567
```

**Step 2: Browse Courts**
```bash
# After login, go to "Sân pickleball"
# Click on any court
# Select date and time slot
# Click "Tiếp tục"
```

**Step 3: Confirm Booking**
```bash
# Review booking details
# Click "Tiến hành thanh toán"
# Payment modal appears
```

**Step 4: Select PayOS Payment**
```bash
# Click "PayOS" button
# Modal closes → QR code modal appears
# You should see:
  - PayOS QR code image
  - Checkout URL link
  - Order amount (VNĐ)
  - "Thanh toán trực tiếp" button
```

**Step 5: Complete Payment**

**Option A: Scan QR Code**
- Open banking app on phone
- Scan QR code from screen
- Confirm payment
- Wait 3-5 seconds

**Option B: Direct Payment Link**
- Click "Thanh toán trực tiếp" button
- New tab opens with PayOS checkout page
- Enter test card details (if using sandbox)
- Confirm payment

**Step 6: Verify Success**
```bash
# After payment:
- Original tab auto-redirects to success page
- Shows "Thanh toán thành công"
- Booking status changes to "confirmed"

# Check database:
SELECT * FROM payments WHERE status = 'completed' ORDER BY created_at DESC;
# Should show 1 new record with transaction_id like: payos_123456789_67890
```

### Backend Logs to Monitor

**During payment initialization:**
```
PayOS Request: { orderCode: 123456789, amount: 100000, description: 'aB3xK9mT2p', ... }
PayOS Response: { code: '00', data: { checkoutUrl: '...', qrCode: '...', ... } }
Payment inserted: ID = 42
```

**During webhook callback (after payment):**
```
PayOS Webhook received: { code: '00', desc: 'success', data: { orderCode: 123456789, ... } }
Payment found: ID = 42
PayOS Webhook: Payment 123456789 completed
Updated booking status to: confirmed
```

### Common Test Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Lỗi khởi tạo thanh toán" | Backend env missing | Check PAYOS_CLIENT_ID, API_KEY, CHECKSUM_KEY |
| "Payment not found" in webhook | Transaction ID mismatch | Run add-transaction-id.sql migration |
| QR code doesn't load | Invalid API credentials | Verify PayOS keys in dashboard |
| Booking stays "pending" | Webhook not received | Check ngrok terminal + PayOS dashboard |
| Status 500 error | Database connection failed | Verify SQL Server running + credentials |

---

## 🔧 Troubleshooting

### Backend Issues

**Problem: "Cannot connect to SQL Server"**
```
Error: Failed to connect to localhost:1433
```

**Solutions:**
1. Check SQL Server service is running:
   ```powershell
   Get-Service MSSQL*
   Start-Service MSSQL$SQLEXPRESS
   ```
2. Verify credentials in `.env`:
   ```env
   DB_SERVER=localhost\SQLEXPRESS  # Add instance name
   DB_USER=sa
   DB_PASSWORD=your_actual_password
   ```
3. Enable TCP/IP protocol:
   - Open SQL Server Configuration Manager
   - Protocols for SQLEXPRESS → TCP/IP → Enable
   - Restart SQL Server service

**Problem: "Port 5000 already in use"**
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solutions:**
```powershell
# Find process using port 5000
netstat -ano | findstr :5000

# Kill the process (replace PID)
taskkill /PID <PID> /F

# Or change port in .env
PORT=5001
```

**Problem: "Module not found: ts-node"**

**Solution:**
```bash
cd sever
npm install --save-dev ts-node @types/node
npm run dev
```

### Frontend Issues

**Problem: "API calls return 404"**

**Causes:**
- Backend not running on port 5000
- Vite proxy misconfigured

**Solutions:**
```bash
# Verify backend is running
curl http://localhost:5000/api/health

# Check vite.config.ts proxy settings
# Should be: target: 'http://localhost:5000'
```

**Problem: "CORS errors in browser console"**

**Solution:**
Backend should have CORS enabled in `sever/index.ts`:
```typescript
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
```

### PayOS Issues

**Problem: "Invalid signature"**

**Causes:**
- Wrong CHECKSUM_KEY
- Data not sorted alphabetically before signing

**Solution:**
```bash
# Verify checksum key in PayOS dashboard
# Re-copy all 3 credentials (Client ID, API Key, Checksum Key)
# Restart backend after updating .env
```

**Problem: "Webhook not received"**

**Debugging steps:**
1. Check ngrok terminal is running and shows requests
2. Verify webhook URL in PayOS dashboard matches ngrok URL
3. Test webhook manually:
   ```bash
   curl -X POST https://your-ngrok-url.ngrok-free.app/api/payments/payos-webhook \
     -H "Content-Type: application/json" \
     -d '{"code":"00","desc":"success","data":{"orderCode":123456789}}'
   ```
4. Check backend terminal for logs starting with "PayOS Webhook"

**Problem: "Description exceeds 25 characters"**

**Already fixed:** Backend now generates random 10-character descriptions.

If you see this error:
- Update to latest code
- Function `generateRandomDescription()` in `payment.controller.ts` handles this

### Database Issues

**Problem: "Column 'transaction_id' does not exist"**

**Solution:**
```bash
cd sever/database
sqlcmd -S localhost -U sa -P your_password -d pickleball_danang -i add-transaction-id.sql
```

**Problem: "Duplicate payment entries"**

**Already fixed:** Backend now skips payment insert in `createBooking` when payment_method is 'payos'.

Verify fix is applied in `sever/controllers/booking.controller.ts`:
```typescript
const isPayOS = payment_method === 'payos';
// ...
if (!isPayOS) {
    // INSERT payment only for non-PayOS methods
}
```

---

## 📁 Project Structure

```
pickleball-booking-network-v1.0/
│
├── client/                          # Frontend (React + TypeScript)
│   ├── src/
│   │   ├── api/
│   │   │   └── axios.ts            # Axios instance with JWT interceptor
│   │   ├── components/
│   │   │   ├── PaymentModal.tsx    # Payment method selection
│   │   │   ├── PayOSPayment.tsx    # QR code display + polling
│   │   │   ├── PaymentResult.tsx   # Success/failure page
│   │   │   ├── Navbar.tsx          # Navigation bar
│   │   │   └── ...                 # Other components
│   │   ├── context/
│   │   │   └── AuthContext.tsx     # Authentication context
│   │   ├── pages/
│   │   │   ├── Booking.tsx         # Court booking flow (3 steps)
│   │   │   ├── Courts.tsx          # Court listing
│   │   │   ├── Login.tsx           # Login page
│   │   │   └── ...                 # Other pages
│   │   ├── styles/                 # CSS Modules
│   │   ├── types/
│   │   │   └── index.ts            # TypeScript interfaces
│   │   └── main.tsx                # App entry point
│   ├── vite.config.ts              # Vite configuration (proxy)
│   ├── tsconfig.json               # TypeScript config
│   └── package.json
│
├── sever/                           # Backend (Express + TypeScript)
│   ├── config/
│   │   └── db.ts                   # SQL Server connection pool
│   ├── controllers/
│   │   ├── payment.controller.ts   # PayOS payment logic (6 functions)
│   │   ├── booking.controller.ts   # Booking CRUD
│   │   ├── auth.controller.ts      # Login/register/JWT
│   │   └── ...                     # Other controllers
│   ├── database/
│   │   ├── schema.sql              # Database schema (12 tables)
│   │   ├── add-transaction-id.sql  # Payment enhancement migration
│   │   └── migrate.ts              # Migration runner
│   ├── middleware/
│   │   ├── auth.ts                 # JWT verification middleware
│   │   └── role.ts                 # Role-based access control
│   ├── routes/
│   │   ├── payment.routes.ts       # Payment endpoints (7 routes)
│   │   ├── booking.routes.ts       # Booking endpoints
│   │   └── ...                     # Other routes
│   ├── socket/
│   │   └── index.ts                # Socket.io chat logic
│   ├── types/
│   │   └── index.ts                # TypeScript interfaces
│   ├── utils/
│   │   └── response.ts             # Response helpers (NEW)
│   ├── index.ts                    # Server entry point
│   ├── tsconfig.json               # TypeScript config
│   ├── .env                        # Environment variables (not in git)
│   └── package.json
│
├── SETUP_PAYOS_LOCAL.md            # PayOS setup guide (1000+ lines)
├── QUICK_TEST_PAYOS.md             # Quick start guide (15 min)
├── PAYOS_DASHBOARD_GUIDE.md        # PayOS dashboard navigation
├── API_REFERENCE.md                # API documentation
├── DOCUMENTS_INDEX.md              # Documentation index
├── PROJECT_SETUP_GUIDE.md          # This file (complete setup)
├── PROGRESS_REVIEW.md              # Development progress (NEW)
└── README.md                        # Project overview
```

### Key Files Explained

**Frontend:**
- `api/axios.ts` - Configured Axios instance with:
  - Base URL: `/api` (proxied to backend)
  - JWT token interceptor (auto-adds `Authorization` header)
  - Token refresh on 401 errors

- `components/PaymentModal.tsx` - Payment flow:
  1. User clicks payment method (PayOS/Mock)
  2. Calls `/api/payments/payos-init`
  3. Receives checkout URL + QR code
  4. Opens PayOSPayment component

- `pages/Booking.tsx` - Booking flow:
  - Step 1: Confirm details (date, time, court)
  - Step 2: Payment (PaymentModal)
  - Step 3: Success (confirmation message)

**Backend:**
- `controllers/payment.controller.ts` - PayOS integration:
  1. `payosInit()` - Create payment link
  2. `payosWebhook()` - Receive payment status from PayOS
  3. `payosReturn()` - Handle user redirect after payment
  4. `payosCheckStatus()` - Poll payment status (frontend uses this)
  5. `payosGetInfo()` - Get payment details by ID
  6. `payosCancelPayment()` - Cancel active payment link

- `utils/response.ts` - Standardized responses:
  - `successResponse(res, data, message)` - Returns `{code: 0, ...}`
  - `errorResponse(res, message, error)` - Returns `{code: 1, ...}`
  - `serverError(res, message, error)` - Returns `{code: 1, status: 500}`
  - `webhookResponse(res, message)` - Returns `{code: '00'}` for PayOS

**Database:**
- `database/schema.sql` - Creates 12 tables:
  - `users` - User accounts (username, email, password hash)
  - `courts` - Pickleball courts (name, location, price)
  - `bookings` - Court reservations (user_id, court_id, date, time)
  - `payments` - Payment records (amount, status, transaction_id)
  - `matches` - Matchmaking games
  - `chats` - Chat threads
  - `messages` - Chat messages
  - `notifications` - User notifications
  - `posts` - Community posts
  - `comments` - Post comments
  - `user_roles` - Role assignments (admin/owner/user)
  - `court_schedules` - Available time slots

- `database/add-transaction-id.sql` - Adds:
  - Column: `transaction_id NVARCHAR(100) UNIQUE`
  - Prevents duplicate charges via idempotency check
  - Format: `payos_{orderCode}_{paymentLinkId}`

---

## 🎓 Learning Resources

### PayOS Documentation
- Main Docs: https://payos.vn/docs
- API Reference: https://payos.vn/docs/api
- Webhook Guide: https://payos.vn/docs/webhook
- Test Cards: https://payos.vn/docs/testing

### Project Documentation
- **SETUP_PAYOS_LOCAL.md** - Detailed PayOS setup (1000+ lines)
- **QUICK_TEST_PAYOS.md** - 15-minute quick start
- **PAYOS_DASHBOARD_GUIDE.md** - Dashboard walkthrough with diagrams
- **API_REFERENCE.md** - All API endpoints, request/response examples
- **DOCUMENTS_INDEX.md** - Documentation reading path

### TypeScript Resources
- Official Docs: https://www.typescriptlang.org/docs
- React + TypeScript: https://react-typescript-cheatsheet.netlify.app
- Express + TypeScript: https://blog.logrocket.com/how-to-set-up-node-typescript-express

---

## 📝 Quick Reference Commands

### Development Commands

```bash
# Start all services (3 terminals)
Terminal 1: cd sever && npm run dev
Terminal 2: cd client && npm run dev
Terminal 3: ngrok http 5000

# Kill all Node processes (Windows)
taskkill /F /IM node.exe

# Kill all Node processes (macOS/Linux)
killall node

# Restart backend after .env changes
cd sever
Ctrl+C
npm run dev

# Check database connection
sqlcmd -S localhost -U sa -P password -Q "SELECT @@VERSION"

# View backend logs with output redirection
cd sever
npm run dev 2>&1 | Tee-Object -FilePath backend.log

# Test API endpoint
curl http://localhost:5000/api/health
```

### Database Commands

```bash
# Connect to database
sqlcmd -S localhost -U sa -P password -d pickleball_danang

# Run query
sqlcmd -S localhost -U sa -P password -d pickleball_danang -Q "SELECT * FROM payments"

# Execute script
sqlcmd -S localhost -U sa -P password -d pickleball_danang -i schema.sql

# Backup database
sqlcmd -S localhost -U sa -P password -Q "BACKUP DATABASE pickleball_danang TO DISK='C:\backup\db.bak'"
```

### Ngrok Commands

```bash
# Start tunnel
ngrok http 5000

# Start with custom domain (paid plan)
ngrok http 5000 --domain=your-domain.ngrok-free.app

# View requests UI
# Open: http://localhost:4040
```

---

## 🚨 Production Deployment Checklist

Before deploying to production:

### Security
- [ ] Change `JWT_SECRET` to strong random string (32+ chars)
- [ ] Use environment-specific `.env` files (never commit to git)
- [ ] Enable HTTPS for all endpoints
- [ ] Configure CORS to allow only production frontend domain
- [ ] Use PayOS production credentials (not sandbox/test)
- [ ] Enable rate limiting on API endpoints
- [ ] Sanitize all user inputs to prevent SQL injection
- [ ] Add Helmet.js middleware for security headers
- [ ] Enable SQL Server encryption (TLS)

### Database
- [ ] Create production database with strong password
- [ ] Backup database regularly (automated schedule)
- [ ] Index frequently queried columns (user_id, booking_id, etc.)
- [ ] Set up database connection pooling (already configured)
- [ ] Configure SQL Server firewall rules
- [ ] Enable database monitoring and alerts

### Infrastructure
- [ ] Deploy backend to cloud (Azure, AWS, Heroku, Railway)
- [ ] Deploy frontend to CDN (Vercel, Netlify, CloudFlare Pages)
- [ ] Set up proper webhook URL (no ngrok in production!)
- [ ] Configure DNS for custom domain
- [ ] Enable CDN caching for static assets
- [ ] Set up SSL certificates (Let's Encrypt or cloud provider)

### Monitoring
- [ ] Add application logging (Winston, Pino, or cloud provider)
- [ ] Set up error tracking (Sentry, Rollbar, or similar)
- [ ] Monitor payment webhook success rate
- [ ] Track API response times
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom)
- [ ] Create dashboard for payment metrics

### PayOS Production
- [ ] Complete business verification in PayOS dashboard
- [ ] Switch to production API keys (not test/sandbox)
- [ ] Update webhook URL to production domain
- [ ] Test payment flow with real bank account
- [ ] Verify webhook signature validation works
- [ ] Set up PayOS transaction monitoring

---

## 🤝 Contributing

If you're working on this project as a team:

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/payment-enhancements

# Commit changes
git add .
git commit -m "feat: add PayOS payment integration"

# Push to remote
git push origin feature/payment-enhancements

# Create pull request on GitHub/GitLab
```

### Code Style

- Follow existing TypeScript conventions
- Use meaningful variable names
- Add comments for complex logic
- Keep functions small and focused
- Use helper functions from `utils/response.ts`

### Commit Message Format

```
feat: Add PayOS webhook handler
fix: Resolve duplicate payment insert issue
docs: Update setup guide with ngrok instructions
refactor: Extract response helpers to utils
test: Add payment flow integration tests
```

---

## 📞 Support & Help

### Common Questions

**Q: Why does ngrok URL keep changing?**
A: Free ngrok accounts get random URLs on each restart. Upgrade to paid plan for static domains.

**Q: Can I test payments without real bank account?**
A: Yes, PayOS provides sandbox mode with test credentials. Check PayOS dashboard for test card numbers.

**Q: How do I add new payment methods?**
A: Extend `PaymentModal.tsx` with new buttons and create corresponding backend controllers.

**Q: Database connection times out randomly**
A: Enable TCP/IP protocol in SQL Server Configuration Manager and check Windows Firewall.

### Documentation Files

For specific topics, see:
- **PayOS Setup**: SETUP_PAYOS_LOCAL.md
- **Quick Start**: QUICK_TEST_PAYOS.md
- **API Reference**: API_REFERENCE.md
- **Progress Review**: PROGRESS_REVIEW.md (today/issues/tomorrow)

---

## ✅ Success Indicators

You've successfully set up the project when:

- ✅ Backend server runs without errors on http://localhost:5000
- ✅ Frontend loads on http://localhost:5173
- ✅ Can register new user and login
- ✅ Can browse courts and view details
- ✅ Can create booking (step 1 works)
- ✅ Payment modal appears (step 2 works)
- ✅ Clicking "PayOS" shows QR code
- ✅ QR code can be scanned with banking app
- ✅ After payment, booking status changes to "confirmed"
- ✅ Database shows payment record with status "completed"
- ✅ Backend logs show "PayOS Webhook: Payment X completed"

---

## 📚 Next Steps

After completing setup:

1. **Review PROGRESS_REVIEW.md** - See what's been done and what's next
2. **Test payment flow** - Complete end-to-end payment test
3. **Explore API** - Read API_REFERENCE.md for all endpoints
4. **Customize features** - Add your own enhancements
5. **Deploy to production** - Follow deployment checklist above

---

**Last Updated**: March 2, 2026  
**Version**: 1.0  
**Maintainers**: Development Team

---

Good luck with your setup! 🎾 If you encounter any issues not covered in this guide, check the other documentation files or reach out to the team.
