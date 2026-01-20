# Frontend Code Structure Guide

## Overview
This document explains the organized code structure for the NTrader frontend.

---

## Directory Structure

```
client/src/
├── components/
│   ├── admin/                # Admin dashboard components (to be migrated)
│   │   └── index.js          # Component exports
│   ├── IOSComponents.jsx     # iOS-style UI components
│   └── MarketWatch.jsx       # Market watch component
│
├── context/
│   └── AuthContext.jsx       # Authentication state management
│
├── pages/
│   ├── AdminDashboard.jsx    # Main admin dashboard (14000+ lines - needs splitting)
│   ├── AdminLogin.jsx        # Admin login page
│   ├── UserDashboard.jsx     # User trading dashboard
│   └── ...
│
├── App.jsx                   # Main app with routing
├── main.jsx                  # Entry point
└── index.css                 # Global styles
```

---

## AdminDashboard.jsx Structure

The main admin dashboard file contains many components that should be split:

### Current Components (in AdminDashboard.jsx)

| Component | Lines | Description |
|-----------|-------|-------------|
| `AdminDashboard` | Main | Layout with sidebar navigation |
| `SuperAdminDashboard` | ~200 | Super Admin home stats |
| `AdminDashboardHome` | ~150 | Admin/Broker home stats |
| `AdminManagement` | ~400 | Hierarchy management (Admin/Broker/SubBroker) |
| `CreateAdminModal` | ~120 | Create new subordinate modal |
| `UserManagement` | ~500 | User CRUD operations |
| `AdminWallet` | ~250 | Wallet view & fund requests |
| `SubordinateFundRequests` | ~180 | Approve subordinate requests |
| `FundRequests` | ~300 | User fund request management |
| `AllUsersManagement` | ~400 | Super Admin user view |
| `TradingPanel` | ~500 | Market watch & trading |
| `ProfileSettings` | ~200 | Admin profile settings |
| ... | | Many more |

### Recommended Split Structure

```
components/admin/
├── layout/
│   ├── AdminLayout.jsx       # Main layout with sidebar
│   ├── Sidebar.jsx           # Navigation sidebar
│   └── Header.jsx            # Top header bar
│
├── dashboard/
│   ├── SuperAdminDashboard.jsx
│   ├── AdminDashboardHome.jsx
│   └── StatCard.jsx          # Reusable stat card
│
├── hierarchy/
│   ├── HierarchyManagement.jsx   # Admin/Broker/SubBroker list
│   ├── CreateSubordinateModal.jsx
│   ├── SubordinateDetails.jsx
│   └── SubordinateCard.jsx
│
├── users/
│   ├── UserManagement.jsx    # User list
│   ├── CreateUserModal.jsx
│   ├── UserDetails.jsx
│   └── UserCard.jsx
│
├── wallet/
│   ├── AdminWallet.jsx       # Own wallet view
│   ├── RequestFundModal.jsx
│   ├── SubordinateFundRequests.jsx
│   └── WalletLedger.jsx
│
├── funds/
│   ├── FundRequests.jsx      # User fund requests
│   ├── FundRequestCard.jsx
│   └── ApproveRejectModal.jsx
│
└── common/
    ├── Pagination.jsx
    ├── SearchInput.jsx
    ├── StatusBadge.jsx
    └── RoleBadge.jsx
```

---

## Role-Based Navigation

### Super Admin Menu
- Dashboard
- Hierarchy Management (Admin/Broker/SubBroker)
- All Users
- All Positions
- All Fund Requests
- Create User
- Instruments
- Admin Fund Requests
- Market Control
- Bank Settings
- Profile

### Admin Menu
- Dashboard
- My Wallet
- Broker/SubBroker Management
- Subordinate Requests
- User Management
- Create User
- Market Watch
- Positions
- User Fund Requests
- Bank Accounts
- Transactions
- Profile

### Broker Menu
- Dashboard
- My Wallet
- Sub Broker Management
- SubBroker Requests
- User Management
- Create User
- Market Watch
- Positions
- User Fund Requests
- Bank Accounts
- Transactions
- Profile

### Sub Broker Menu
- Dashboard
- My Wallet
- User Management
- Create User
- Market Watch
- Positions
- User Fund Requests
- Bank Accounts
- Transactions
- Profile

---

## Color Coding

### Role Colors
| Role | Badge Color | Button Color |
|------|-------------|--------------|
| Super Admin | Yellow | `bg-yellow-600` |
| Admin | Purple | `bg-purple-600` |
| Broker | Blue | `bg-blue-600` |
| Sub Broker | Green | `bg-green-600` |

### Status Colors
| Status | Color |
|--------|-------|
| Active | Green (`bg-green-500/20 text-green-400`) |
| Inactive/Suspended | Red (`bg-red-500/20 text-red-400`) |
| Pending | Yellow (`bg-yellow-500/20 text-yellow-400`) |

---

## Hooks & Utilities

### usePagination Hook
Located in AdminDashboard.jsx - should be extracted:

```javascript
const usePagination = (data, itemsPerPage, searchTerm, searchFields) => {
  // Returns: { currentPage, setCurrentPage, totalPages, paginatedData, totalItems }
};
```

### useAuth Hook
From AuthContext - provides:
- `admin` - Current admin data
- `loginAdmin` - Login function
- `logoutAdmin` - Logout function
- `updateAdmin` - Update admin state

---

## API Endpoints Used

### Hierarchy
- `GET /api/admin/manage/admins` - Get subordinates
- `POST /api/admin/manage/admins` - Create subordinate
- `PUT /api/admin/manage/admins/:id` - Update subordinate
- `PUT /api/admin/manage/admins/:id/status` - Toggle status

### Wallet
- `GET /api/admin/manage/my-wallet` - Get wallet
- `POST /api/admin/manage/fund-request` - Request funds
- `GET /api/admin/manage/admin-fund-requests` - Get subordinate requests
- `PUT /api/admin/manage/admin-fund-requests/:id` - Approve/reject

### Users
- `GET /api/admin/users` - Get users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/:id` - Update user
- `PUT /api/admin/users/:id/wallet` - Manage wallet

---

## Migration Steps

To split AdminDashboard.jsx:

1. **Extract hooks** to `hooks/` folder
2. **Extract common components** to `components/common/`
3. **Extract modals** to respective feature folders
4. **Extract page components** one by one
5. **Update imports** in AdminDashboard.jsx
6. **Test each extraction** before moving to next

---

## Coding Standards

### Component Structure
```jsx
/**
 * ComponentName
 * Brief description
 */
const ComponentName = ({ prop1, prop2 }) => {
  // State
  const [state, setState] = useState();
  
  // Effects
  useEffect(() => {}, []);
  
  // Handlers
  const handleAction = () => {};
  
  // Render
  return (
    <div>...</div>
  );
};

export default ComponentName;
```

### Tailwind Classes
- Use consistent spacing: `p-4`, `gap-4`, `mb-6`
- Use dark theme classes: `bg-dark-800`, `text-gray-400`
- Use hover states: `hover:bg-dark-700`
