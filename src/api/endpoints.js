module.exports = {
  // Core endpoints
  SELF: '/self',
  
  // Invoice endpoints
  INVOICES: '/invoices',
  INVOICES_DRAFTS: '/invoices/drafts',
  INVOICES_BOOKED: '/invoices/booked',
  INVOICES_PAID: '/invoices/paid',
  INVOICES_UNPAID: '/invoices/unpaid',
  INVOICES_OVERDUE: '/invoices/overdue',
  INVOICES_NOT_DUE: '/invoices/not-due',
  
  // Customer endpoints
  CUSTOMERS: '/customers',
  
  // Helper functions
  customerInvoices: (customerId, type = 'drafts') => `/customers/${customerId}/invoices/${type}`
};