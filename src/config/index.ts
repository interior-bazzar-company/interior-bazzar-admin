const config = {
  MODE: import.meta.env.VITE_MODE,
  BASE_URL: import.meta.env.VITE_BASE_URL,
  // The public storefront. Read by the account menu's "Preview portal", which is
  // a one-way look at the customer-facing site — never a role change.
  FRONTEND_URL: import.meta.env.VITE_FRONTEND_URL,
};
export default config;
