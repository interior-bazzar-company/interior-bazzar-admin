const resolveBaseUrl = () => {
  const envUrl = import.meta.env.VITE_BASE_URL;
  if (typeof window !== "undefined" && window.location?.hostname && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    return `http://${window.location.hostname}:8000/api`;
  }
  return envUrl || "http://localhost:8000/api";
};

const config = {
  MODE: import.meta.env.VITE_MODE,
  BASE_URL: resolveBaseUrl(),
  // The public storefront. Read by the account menu's "Preview portal", which is
  // a one-way look at the customer-facing site — never a role change.
  FRONTEND_URL: import.meta.env.VITE_FRONTEND_URL,
};
export default config;
