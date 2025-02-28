module.exports = {
  // Core endpoints
  SELF: '/self',
  
  // Invoice specific endpoints
  INVOICES: '/invoices',
  INVOICES_DRAFTS: '/invoices/drafts',
  INVOICES_BOOKED: '/invoices/booked',
  INVOICES_PAID: '/invoices/paid',
  INVOICES_UNPAID: '/invoices/unpaid',
  INVOICES_OVERDUE: '/invoices/overdue',
  INVOICES_NOT_DUE: '/invoices/not-due',
  
  // General endpoints
  PAYMENT_TERMS: '/payment-terms',
  PRODUCT_GROUPS: '/product-groups',
  PRODUCTS: '/products',
  SUPPLIER_GROUPS: '/supplier-groups',
  SUPPLIERS: '/suppliers',
  VAT_ACCOUNTS: '/vat-accounts',
  ACCOUNTING_YEARS: '/accounting-years',
  ACCOUNTS: '/accounts',
  CUSTOMERS: '/customers',
  DEPARTMENTS: '/departments',
  DEPARTMENTAL_DISTRIBUTIONS: '/departmental-distributions',
  JOURNALS: '/journals',

  // Customer endpoints
  CUSTOMERS: '/customers',
  
  // Helper functions
  customerInvoices: (customerId, type = 'drafts') => `/customers/${customerId}/invoices/${type}`,
  suppliersByGroup: (groupId) => `/supplier-groups/${groupId}/suppliers`,
  productsByGroup: (groupId) => `/product-groups/${groupId}/products`
  
};