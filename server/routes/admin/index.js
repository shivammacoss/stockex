/**
 * Admin Routes Index
 * Combines all admin management routes into a single router
 * 
 * Structure:
 * /api/admin/manage/
 * ├── /admins/*           → hierarchyRoutes (Admin/Broker/SubBroker management)
 * ├── /users/*            → userManagementRoutes (User CRUD)
 * ├── /my-wallet          → walletRoutes (Wallet & fund requests)
 * ├── /my-ledger          → walletRoutes
 * ├── /fund-request       → walletRoutes
 * ├── /admin-fund-requests→ walletRoutes
 * └── ... other routes
 */

import express from 'express';
import hierarchyRoutes from './hierarchyRoutes.js';
import walletRoutes from './walletRoutes.js';
import userManagementRoutes from './userManagementRoutes.js';

const router = express.Router();

// ============================================================================
// ROUTE MOUNTING
// ============================================================================

/**
 * Hierarchy Routes - Admin/Broker/SubBroker management
 * Mounted at: /api/admin/manage/admins/*
 */
router.use('/admins', hierarchyRoutes);

/**
 * Wallet Routes - Wallet operations & fund requests
 * Mounted at: /api/admin/manage/*
 */
router.use('/', walletRoutes);

/**
 * User Management Routes - User CRUD operations
 * Mounted at: /api/admin/manage/users/*
 */
router.use('/users', userManagementRoutes);

// ============================================================================
// HEALTH CHECK
// ============================================================================

router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'admin-management',
    timestamp: new Date().toISOString()
  });
});

export default router;
