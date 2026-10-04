# 🎟️ EventHub — Full-Stack Enterprise Event Management & Ticketing Platform

[![Node.js](https://img.shields.io/badge/Node.js-v18+-68a063?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.19-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-19.2-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.2-646cff?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.3-38bdf8?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB_Atlas-8.5-47a248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Razorpay](https://img.shields.io/badge/Razorpay-Gateway-0c2340?style=for-the-badge&logo=razorpay&logoColor=white)](https://razorpay.com/)
[![Live Frontend](https://img.shields.io/badge/Live_App-Vercel-black?style=for-the-badge&logo=vercel&logoColor=white)](https://event-booking-system-umber-two.vercel.app/)
[![Production API](https://img.shields.io/badge/API_Status-Live_on_Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://event-booking-backend-d2tw.onrender.com/)
[![Test Suites](https://img.shields.io/badge/Edge_Case_Tests-72%2F72_Passed-success?style=for-the-badge&logo=checkmarx&logoColor=white)](backend/tests/)

> 🌐 **Live Web Application**: [https://event-booking-system-umber-two.vercel.app](https://event-booking-system-umber-two.vercel.app/)  
> ⚡ **Production API Base**: [https://event-booking-backend-d2tw.onrender.com](https://event-booking-backend-d2tw.onrender.com)

**EventHub** is a high-performance, full-stack MERN event discovery, booking, and administrative platform engineered with enterprise-grade reliability. It features multi-tier ticket reservations, temporary hold expirations, bank-grade Razorpay payment processing with HMAC-SHA256 signature verification, camera-based gate QR check-ins, automated HTML emails with inline CID QR attachments, attendee lucky draws, and business intelligence reporting.


---

## 📑 Table of Contents

- [Architectural Overview](#-architectural-overview)
- [Key Features by Role](#-key-features-by-role)
  - [Customer Experience](#1-customer-experience)
  - [Organizer Studio](#2-organizer-studio)
  - [Admin Governance Portal](#3-admin-governance-portal)
- [Core Engineering Mechanisms](#-core-engineering-mechanisms)
- [Tech Stack](#-tech-stack)
- [Project Directory Layout](#-project-directory-layout)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Environment Variables](#environment-variables)
  - [Database Seeding & Test Credentials](#database-seeding--test-credentials)
- [Automated Edge Case Test Suites](#-automated-edge-case-test-suites)
- [REST API Reference](#-rest-api-reference)
- [License](#-license)

---

## 🏛️ Architectural Overview

```
                          ┌─────────────────────────────────────┐
                          │         React 19 + Vite +           │
                          │        Tailwind CSS v4 Client       │
                          └──────────────────┬──────────────────┘
                                             │ REST API / Axios
                                             ▼
                          ┌─────────────────────────────────────┐
                          │        Express.js API Server        │
                          │           (Port 5001)               │
                          └──────┬───────────┬───────────┬──────┘
                                 │           │           │
            ┌────────────────────┘           │           └────────────────────┐
            ▼                                ▼                                ▼
┌───────────────────────┐        ┌───────────────────────┐        ┌───────────────────────┐
│     MongoDB Atlas     │        │   Razorpay Gateway    │        │  Nodemailer SMTP      │
│  - Users, Events      │        │  - Orders & Webhooks  │        │  - Inline CID QR Mail │
│  - Bookings, Payments │        │  - HMAC Verification  │        │  - Event Reminders    │
│  - Vouchers, Receipts │        └───────────────────────┘        └───────────────────────┘
└───────────────────────┘
            ▲
            │ Background Cron Jobs
┌───────────┴──────────────────────────────────────────┐
│  • Booking Expiry (10-min hold release engine)       │
│  • Event Reminders (24h & 1h notification triggers)  │
│  • Event Status Lifecycle Updater                    │
└──────────────────────────────────────────────────────┘
```

---

## 🌟 Key Features by Role

### 1. Customer Experience
* **Event Discovery & Filtering**: Search and filter live events by category, date, price, and venue with instantaneous client-side feedback.
* **Multi-Tier Seat Reservation**: Choose from multiple tiers (e.g., General, VIP, Premium) with dynamic pricing and live capacity calculation.
* **10-Minute Hold Reservation**: Seats are temporarily held during checkout; if uncompleted, background workers cleanly release seats back to the inventory pool.
* **Promo Code & Voucher Redemptions**: Apply discount vouchers with real-time validation (expiry dates, minimum spends, maximum discount ceilings).
* **Enterprise Payment Checkout**: Seamless integration with Razorpay supporting Debit/Credit Cards, Net Banking, and Wallets.
* **Digital Ticket Wallet**: Direct access to confirmed passes featuring scannable high-resolution QR codes cryptographically linked to the booking ID.
* **Single-Page PDF & Print Layout**: Download formatted, tamper-evident PDF tickets and formal tax invoices formatted cleanly for single-page printing.
* **Instant Email Confirmations**: Receive confirmation emails with the admission QR code embedded directly as an inline `cid:` attachment, rendering flawlessly in Gmail and other strict webmail clients without external image blocking.
* **Attendee Lucky Draw Rewards**: Attend verified events to participate in randomized post-event lucky draws and win promotional vouchers.
* **Notification Center**: Real-time alerts for booking confirmations, event updates, reminders, and exclusive vouchers.

### 2. Organizer Studio
* **Event Lifecycle Management**: Publish, edit, and cancel events with support for custom banner uploads (Multer with 5MB validation and image MIME checks).
* **Tiered Ticket Configurations**: Define custom seat capacities, tier names, and price points per event.
* **Live Camera Gate QR Scanner**: Built-in HTML5 webcam QR code scanner and manual ticket code lookup for gate staff. Validates admissions in real time, preventing duplicate check-ins or forged tickets.
* **Attendee Roster Management**: Monitor attendee lists, check-in status, contact information, and seating tiers.
* **Automated Lucky Draw Engine**: Execute randomized prize draws among checked-in attendees. The system automatically mints and attributes unique promo vouchers to winners.
* **Financial Analytics**: View event-specific ticket volume, gross revenues, and check-in percentages.

### 3. Admin Governance Portal
* **Executive BI Dashboard**: Overview of platform-wide metrics including total revenue, active bookings, published events, and user growth.
* **User Directory**: View, filter, and inspect registered users and role permissions (`CUSTOMER`, `ORGANIZER`, `ADMIN`).
* **Platform Audit & Compliance Reports**: Generate custom operational reports filtered by date ranges, event categories, or organizers.
* **Single-Page Report PDF Generator**: Export professional executive-ready PDF audit reports formatted with dedicated single-page print stylesheets.

---

## ⚙️ Core Engineering Mechanisms

1. **Two-Phase Seat Booking & Hold Expiry**:
   When a user initiates checkout, seats are reserved with a status of `Pending` and a 10-minute hold timestamp. A background cron worker (`jobs/bookingExpiryJob.js`) scans for expired pending bookings every minute, releasing reserved inventory back to the event tier if payment is not finalized.
2. **Bank-Grade Payment Verification**:
   Payments are verified using HMAC-SHA256 signatures generated with the secret key (`razorpay_order_id|razorpay_payment_id`). State transitions are idempotent and protected against replay attacks.
3. **Gmail-Safe Inline CID Attachments**:
   Unlike standard `data:image/png;base64` URLs which Gmail and corporate webmail clients strip for security, tickets generate QR codes as raw PNG buffers and attach them using MIME `Content-ID` (`cid:ticket_qr_<bookingId>`), guaranteeing immediate visual rendering without requiring users to click "Display images".
4. **Strict Role-Based URL Guards**:
   Custom React router guards prevent unauthorized access to sensitive portals. Organizers attempting to book tickets or customers attempting to access administrative studios are gracefully redirected with descriptive status alerts (403 Access Denied / 404 Not Found).

---

## 💻 Tech Stack

### Frontend
- **Framework**: [React 19](https://react.dev/) + [Vite 8](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **QR Code Scanner**: [html5-qrcode](https://github.com/mebjas/html5-qrcode)
- **PDF Generation**: [jsPDF](https://github.com/parallax/jsPDF)
- **HTTP Client**: [Axios](https://axios-http.com/)

### Backend
- **Runtime**: [Node.js](https://nodejs.org/) (v18+) & [Express.js](https://expressjs.com/)
- **Database**: [MongoDB Atlas](https://www.mongodb.com/atlas) with [Mongoose 8](https://mongoosejs.com/)
- **Payment Processing**: [Razorpay Node SDK](https://github.com/razorpay/razorpay-node)
- **Mailing Engine**: [Nodemailer](https://nodemailer.com/) (Gmail SMTP with inline CID attachments)
- **Cron Jobs**: [node-cron](https://github.com/node-cron/node-cron)
- **File Uploads**: [Multer](https://github.com/expressjs/multer)
- **Authentication**: JWT (`jsonwebtoken`) & `bcryptjs`

---

## 📂 Project Directory Layout

```
event-management-system/
├── backend/
│   ├── config/             # Database connection setup (MongoDB Atlas)
│   ├── controllers/        # Request handlers (auth, events, bookings, payments, etc.)
│   ├── jobs/               # Background cron tasks (hold expiry, reminders, completion)
│   ├── middleware/         # JWT authentication & role-based authorization
│   ├── models/             # Mongoose schemas (User, Event, Booking, Payment, Voucher, etc.)
│   ├── routes/             # Express API route declarations
│   ├── services/           # Business logic (payment verification, email delivery)
│   ├── tests/              # Comprehensive edge-case test suites (72 test cases)
│   ├── utils/              # Calculation helpers, timing constraints, booking logic
│   ├── uploads/            # Uploaded event banner posters
│   ├── seed.js             # Database seeding script with realistic dummy data
│   ├── server.js           # Server entry point & cron initiator
│   └── package.json
├── frontend/
│   ├── public/             # Static assets
│   ├── scripts/            # Automated end-to-end browser verification scripts
│   ├── src/
│   │   ├── components/     # Reusable UI modules (Navbar, PaymentModal, CheckInScanner, etc.)
│   │   ├── context/        # React context providers (AuthContext, ThemeContext)
│   │   ├── pages/          # Application views (EventList, EventDetails, MyBookings, Studio, Admin)
│   │   ├── services/       # Frontend API communication clients
│   │   ├── utils/          # Client PDF generators & Razorpay checkout script loaders
│   │   ├── App.jsx         # Route layout & role protection configuration
│   │   └── main.jsx        # Frontend entry point
│   ├── vite.config.js
│   └── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18.x or newer recommended)
- **npm** (v9.x or newer)
- **MongoDB Atlas** database connection string (or local MongoDB daemon)
- **Razorpay Test Account** (Key ID & Key Secret)
- **Gmail Account** with an generated [App Password](https://support.google.com/accounts/answer/185833) (for email confirmations)

---

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install backend dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your credentials:
   ```env
   MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/event-booking?retryWrites=true&w=majority
   JWT_SECRET=your_super_secret_jwt_key
   RAZORPAY_KEY_ID=rzp_test_YourKeyId
   RAZORPAY_KEY_SECRET=YourRazorpaySecret
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_gmail_app_password
   PORT=5001
   ```

4. *(Optional)* Seed the database with sample events, tiers, organizers, and users:
   ```bash
   node seed.js
   ```

5. Launch the backend server:
   ```bash
   # Development mode with hot-reloading:
   npm run dev

   # Or production start:
   npm start
   ```
   *The backend will boot on `http://localhost:5001`.*

---

### Frontend Setup

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. *(Optional)* Configure frontend environment:
   ```bash
   cp .env.example .env
   ```
   *(Defaults to `http://localhost:5001/api` if omitted).*

4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *Open your browser at `http://localhost:5173`.*

---

### Database Seeding & Test Credentials

Running `node seed.js` in the `backend/` directory resets and seeds realistic demo data with the following pre-configured credentials:

| Role | Email | Password | Access Capabilities |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@eventhub.com` | `admin123` | Platform BI Analytics, User Governance, Custom Audit Reports |
| **Organizer** | `organizer@eventhub.com` | `organizer123` | Event Creation/Editing, Gate QR Scanner, Lucky Draws, Revenue Reports |
| **Customer** | `customer@eventhub.com` | `customer123` | Event Booking, Seat Holds, Razorpay Checkout, Wallet, PDF Passes |

---

## 🧪 Automated Edge Case Test Suites

EventHub includes **72 automated edge case tests** across 4 dedicated backend suites, verifying every failure mode, security boundary, and concurrent condition:

```bash
# 1. Booking Model & Hold Reservation Lifecycle (18 Edge Cases)
node backend/tests/test_all_booking_edge_cases.js

# 2. Payment Gateway, Webhooks & HMAC Verification (20 Edge Cases)
node backend/tests/test_all_payment_edge_cases.js

# 3. Notification Service, SMTP & Inline CID Email Delivery (17 Edge Cases)
node backend/tests/test_all_notification_edge_cases.js

# 4. Voucher Engine, Promo Constraints & Lucky Draws (17 Edge Cases)
node backend/tests/test_all_voucher_edge_cases.js
```

### Edge Case Verification Summary

| Suite | File | Tests | Coverage |
| :--- | :--- | :---: | :--- |
| **Booking Suite** | `test_all_booking_edge_cases.js` | **18 / 18 Passed** | Overbooking concurrency, hold expirations, negative counts, seat limits, past event lockouts, atomic tier restock on cancellation. |
| **Payment Suite** | `test_all_payment_edge_cases.js` | **20 / 20 Passed** | HMAC signature forgery, webhook replay attacks, zero-amount checkout, duplicate captures, idempotency, refund allocations. |
| **Notification Suite** | `test_all_notification_edge_cases.js` | **17 / 17 Passed** | Inline CID MIME packaging, Gmail webmail rendering, SMTP connection timeouts, unread badge atomicity, multi-channel dispatch. |
| **Voucher Suite** | `test_all_voucher_edge_cases.js` | **17 / 17 Passed** | Expiry timestamps, usage limits, minimum spend guards, maximum discount caps, duplicate codes, role permissions. |
| **Total** | **All 4 Test Suites** | **72 / 72 Passed** | **100% Core Engine Coverage** |

To run the automated browser end-to-end verification script:
```bash
node frontend/scripts/verify_frontend_e2e.js
```

---

## 📡 REST API Reference

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a new account (`CUSTOMER`, `ORGANIZER`).
- `POST /api/auth/login` — Authenticate and receive a JWT.
- `POST /api/auth/logout` — Invalidate user session.

### Events (`/api/events`)
- `GET /api/events` — Retrieve published events with optional filtering.
- `GET /api/events/search` — Search events by title, category, or location.
- `GET /api/events/:id` — Get detailed event information and available tier capacities.
- `GET /api/events/organizer/my-events` — Get events created by the logged-in organizer *(Protected)*.
- `POST /api/events` — Create a new event *(Organizer/Admin)*.
- `PUT /api/events/:id` — Update existing event *(Organizer/Admin)*.
- `DELETE /api/events/:id` — Cancel / delete event *(Organizer/Admin)*.
- `POST /api/events/upload-banner` — Upload event banner poster *(Organizer/Admin)*.

### Bookings & Check-In (`/api/bookings`)
- `POST /api/bookings` — Reserve tickets with 10-minute hold *(Customer)*.
- `GET /api/bookings/my` — Fetch current customer's booking history *(Customer)*.
- `GET /api/bookings/:id` — Retrieve specific booking details & QR payload.
- `DELETE /api/bookings/:id` — Cancel booking and release inventory.
- `POST /api/bookings/check-in` — Validate ticket QR code at event gate *(Organizer/Admin)*.
- `GET /api/bookings/event/:eventId` — Retrieve attendee list for an event *(Organizer/Admin)*.

### Payments (`/api/payments`)
- `POST /api/payments/create-order` — Create Razorpay order for pending booking *(Customer)*.
- `POST /api/payments/verify` — Verify HMAC-SHA256 signature and issue digital pass *(Customer)*.
- `POST /api/payments/razorpay/webhook` — Razorpay webhook endpoint for asynchronous payment updates.
- `GET /api/payments/booking/:bookingId` — Fetch payment and receipt records by booking ID.

### Rewards & Vouchers (`/api/rewards`)
- `POST /api/rewards/apply-promo` — Validate and apply promo code discount *(Customer)*.
- `GET /api/rewards/my-vouchers` — Fetch active vouchers assigned to current user *(Customer)*.
- `GET /api/rewards/event/:eventId` — Get event lucky draw details & attendee entries.
- `POST /api/rewards/event/:eventId` — Configure prize draw parameters *(Organizer/Admin)*.
- `POST /api/rewards/draw/:id` — Execute lucky draw and mint discount vouchers *(Organizer/Admin)*.

### Notifications (`/api/notifications`)
- `GET /api/notifications/my` — Fetch user's notification center alerts.

### Audit & Reports (`/api/reports`)
- `GET /api/reports/bookings` — Generate booking analytics report *(Organizer/Admin)*.
- `GET /api/reports/events` — Generate event performance report *(Organizer/Admin)*.
- `GET /api/reports` — Fetch historical saved reports *(Organizer/Admin)*.

### Admin Governance (`/api/admin`)
- `GET /api/admin/stats` — Platform-wide business intelligence metrics *(Admin)*.
- `GET /api/admin/users` — Browse all registered users *(Admin)*.
- `GET /api/admin/users/:id` — Inspect specific user details *(Admin)*.
- `GET /api/admin/bookings` — View all system-wide bookings *(Admin)*.
- `GET /api/admin/events` — View all platform events *(Admin)*.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
