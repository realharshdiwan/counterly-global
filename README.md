# Counterly — Universal Retail POS & Store Management System

A high-speed, offline-first Point of Sale (POS) and retail store management platform. Built for peak rush-hour retail operations with sub-second billing, dual-display customer standee, rotating tablet support, multi-school/category catalogs, and thermal receipt printing.

---

## 🚀 Key Features

### 1. High-Speed Counter Billing (`F1` – `F9` Shortcuts)
- **Multi-School Single Bill**: Ring up uniforms for different schools (e.g., DAV Shirt + DPS Shorts) in one single receipt.
- **Garment Matrix**: Instant size grid selection (Size 24, 26, 28, 30...) with live stock availability and school-specific rate books.
- **Custom Charges & Alterations**: Quick 1-click addition for alterations (₹50), embroidery monograms (₹30), and custom tailoring.
- **Hold & Park Bills (`F4`)**: Park customer bills during queue bottlenecks and retrieve them instantly.
- **Split Payment**: Split bills across **Cash**, **UPI**, and **Credit (Khata)** with 1-click Auto balance calculation.

### 2. Dual-Display Customer Standee Mode
- **Dual-Monitor Setup**: Secondary HDMI/USB monitor displays a clean, real-time itemized cart, student name, and dynamic UPI QR code for the exact bill total.
- **Quad-Layer Fail-Safe Sync**:
  - `BroadcastChannel` (In-memory tab-to-tab messaging)
  - `IndexedDB` shared database (Cross-window persistence)
  - `localStorage` low-latency event bus
  - `Express REST API Relay` (`/api/customer-display`) for separate window/tablet environments
- **Idle Screen**: Branded welcome screen when no bill is active; wakes up automatically the instant an item is tapped.

### 3. Rotating Tablet Mode (`Flip to Pay`)
- Designed for mobile staff walking queues with a tablet or counter swivel stand.
- **180° Invert View**: 1-click button to flip the orientation towards the parent sitting across the counter.
- **1-Tap Save & Print**: Staff taps "Payment Done & Save Bill" immediately after the customer scans the QR.

### 4. Advance Orders & Tailoring Job Sheets
- Tokenized advance booking system with deposit tracking.
- Status pipeline: `Booked` ➔ `Sent to Tailor` ➔ `Ready for Trial` ➔ `Delivered`.
- Printable tailoring job slips for master cutters and tailors.

### 5. Student Uniform History
- Search parents by mobile number or student name.
- View past uniform purchases, sizes bought last year, and student grade history.

### 6. Multi-School Catalog & Price Book
- School-wise rate lists (e.g. Size 28 DAV Half Shirt = ₹380, DPS = ₹420).
- Automatic batch rate updates across schools and categories.

### 7. Cash Register & Day Closing
- Real-time breakdown of Cash, UPI, Card, and Credit sales.
- Cash drawer reconciliation against expected cash.

---

## ⌨️ Keyboard Shortcuts Cheatsheet

| Key | Action |
| :--- | :--- |
| `F1` | Focus Search Box |
| `F2` | Save & Print Bill |
| `F3` | Quick Cash Checkout |
| `F4` | Hold / Park Current Bill |
| `F7` | Customer Standee / Flip Mode |
| `F8` | Open Barcode / Quick Input |
| `F9` | Open Daily Cash Register |
| `Esc` | Close Any Modal / Dialog |

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Local Persistence**: Dexie.js (IndexedDB) for 100% offline-first reliability
- **Backend / Relay**: Express.js server (`server.ts`) for cross-window customer display relay and Supabase sync
- **Icons & Animation**: Lucide React, Motion
- **QR Code**: qrcode generator (standard UPI specifications)

---

## 📦 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/counterly-pos.git

# Navigate to project directory
cd counterly-pos

# Install dependencies
npm install
```

### Running Locally

```bash
# Start development server
npm run dev
```

Open your browser at `http://localhost:3000`.

### Building for Production

```bash
npm run build
npm start
```

---

## 🌐 Dual-Display Configuration (Secondary Monitor)

1. Connect your secondary customer-facing screen via HDMI/USB.
2. In the top navigation bar of the app, click **`Customer Screen`**.
3. Drag the new window to your secondary display and press **`F11`** for full-screen borderless mode.
4. Any items rung up on the primary billing window will synchronize in real-time.

---

## 📄 License

Proprietary — Developed for Saraswati Garments.
