# Server Code Structure Guide

## Overview
This document explains the organized code structure for the NTrader backend.

---

## Directory Structure

```
server/
├── middleware/
│   └── adminAuth.js          # Authentication & authorization helpers
│
├── models/
│   ├── Admin.js              # Admin/Broker/SubBroker model
│   ├── User.js               # User model
│   ├── AdminFundRequest.js   # Hierarchical fund requests
│   ├── FundRequest.js        # User deposit/withdrawal requests
│   ├── WalletLedger.js       # Transaction history
│   ├── Instrument.js         # Trading instruments
│   └── ...
│
├── routes/
│   ├── admin/                # Organized admin routes (NEW)
│   │   ├── index.js          # Route combiner
│   │   ├── hierarchyRoutes.js    # Admin/Broker/SubBroker CRUD
│   │   ├── walletRoutes.js       # Wallet & fund requests
│   │   └── userManagementRoutes.js # User CRUD by admins
│   │
│   ├── adminRoutes.js        # Admin authentication
│   ├── adminManagementRoutes.js  # Legacy (large file)
│   ├── userRoutes.js         # User authentication & profile
│   ├── tradeRoutes.js        # Trading operations
│   └── ...
│
└── index.js                  # Server entry point
```

---

## Role Hierarchy

```
SUPER_ADMIN (Level 0) - Has unlimited funds, sees everything
    │
    ├── ADMIN (Level 1) - Has wallet, manages Brokers & SubBrokers
    │       │
    │       ├── BROKER (Level 2) - Has wallet, manages SubBrokers
    │       │       │
    │       │       └── SUB_BROKER (Level 3) - Has wallet, manages Users only
    │       │               │
    │       │               └── USER - Trading account
    │       │
    │       └── USER - Trading account
    │
    └── USER - Trading account (created by Super Admin)
```

---

## Middleware (`middleware/adminAuth.js`)

### Authentication
- `protectAdmin` - Validates JWT token, checks admin status
- `generateToken` - Creates JWT for admin login

### Authorization
- `superAdminOnly` - Restricts to SUPER_ADMIN only
- `adminOrHigher` - Restricts to SUPER_ADMIN or ADMIN
- `brokerOrHigher` - Restricts to SUPER_ADMIN, ADMIN, or BROKER

### Hierarchy Helpers
- `HIERARCHY_LEVELS` - Role level mapping (0-3)
- `getAllowedChildRoles(role)` - Returns roles that can be created
- `canManageRole(requester, target)` - Checks if can manage
- `applyHierarchyFilter(req, query)` - Filters by hierarchy
- `applyAdminFilter(req, query)` - Filters by adminCode

---

## Routes

### Hierarchy Routes (`routes/admin/hierarchyRoutes.js`)
Manages Admin → Broker → Sub Broker hierarchy.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admins` | Get all subordinates |
| POST | `/admins` | Create subordinate |
| GET | `/admins/:id` | Get subordinate details |
| PUT | `/admins/:id` | Update subordinate |
| PUT | `/admins/:id/status` | Toggle status |
| PUT | `/admins/:id/password` | Reset password |
| PUT | `/admins/:id/charges` | Update charges |

### Wallet Routes (`routes/admin/walletRoutes.js`)
Handles wallet operations and fund requests.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/my-wallet` | Get own wallet |
| GET | `/my-ledger` | Get transaction history |
| GET | `/my-ledger/download` | Download ledger CSV |
| POST | `/fund-request` | Request funds from parent |
| GET | `/my-fund-requests` | Get own requests |
| GET | `/admin-fund-requests` | Get subordinate requests |
| PUT | `/admin-fund-requests/:id` | Approve/reject request |
| PUT | `/admins/:adminId/fund` | Direct fund transfer |

### User Management Routes (`routes/admin/userManagementRoutes.js`)
CRUD operations for users by admins.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | Get all users |
| POST | `/users` | Create user |
| GET | `/users/:id` | Get user details |
| PUT | `/users/:id` | Update user |
| DELETE | `/users/:id` | Delete user |
| PUT | `/users/:id/status` | Toggle status |
| PUT | `/users/:id/password` | Reset password |
| PUT | `/users/:id/wallet` | Add/deduct wallet |
| POST | `/users/:id/transfer` | Transfer user |

---

## Fund Flow

```
Request Flow (upward):
SUB_BROKER → BROKER → ADMIN → SUPER_ADMIN

Approval Flow (downward):
SUPER_ADMIN approves ADMIN requests (unlimited funds)
ADMIN approves BROKER requests (from ADMIN's wallet)
BROKER approves SUB_BROKER requests (from BROKER's wallet)

User Funds:
Any role can add/deduct from their users' wallets
Funds are deducted from admin's wallet when adding to user
```

---

## Coding Standards

### File Headers
Every file should have a JSDoc header explaining its purpose:
```javascript
/**
 * [File Name]
 * [Brief description]
 * 
 * Routes/Functions:
 * - [List main exports]
 */
```

### Section Headers
Use clear section separators:
```javascript
// ============================================================================
// SECTION NAME
// ============================================================================
```

### Function Documentation
Document parameters and returns:
```javascript
/**
 * Description of function
 * @param {type} name - Description
 * @returns {type} Description
 */
```

### Error Handling
Always use try-catch and return meaningful messages:
```javascript
try {
  // logic
  res.json({ message: 'Success', data });
} catch (error) {
  res.status(500).json({ message: error.message });
}
```

---

## Migration Notes

The new organized routes in `routes/admin/` are designed to eventually replace the monolithic `adminManagementRoutes.js`. To migrate:

1. Import new routes in `index.js`
2. Mount at same paths
3. Test thoroughly
4. Remove old routes gradually

---

## Quick Reference

### Check Role Permissions
```javascript
import { canManageRole, getAllowedChildRoles } from '../middleware/adminAuth.js';

// Can this admin manage that role?
if (canManageRole(req.admin.role, 'BROKER')) { ... }

// What roles can this admin create?
const allowed = getAllowedChildRoles(req.admin.role);
```

### Protected Route Pattern
```javascript
import { protectAdmin, superAdminOnly } from '../middleware/adminAuth.js';

// Any authenticated admin
router.get('/route', protectAdmin, handler);

// Super Admin only
router.get('/route', protectAdmin, superAdminOnly, handler);
```
