const resolveBaseUrl = () => {
  const envUrl = import.meta.env.VITE_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  if (typeof window !== "undefined" && window.location?.hostname) {
    const host = window.location.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:8000/api";
    }
    if (host.includes("stageadmin") || host.includes("stage-admin")) {
      return "https://stage.interiorbazzar.com/api";
    }
    if (host.includes("testadmin") || host.includes("dev-admin") || host.includes("devadmin") || host.includes("netlify.app")) {
      return "https://dev.interiorbazzar.com/api";
    }
    if (host.includes("admin.interiorbazzar.com")) {
      return "https://prod.interiorbazzar.com/api";
    }
  }

  return "https://dev.interiorbazzar.com/api";
};

const config = {
  MODE: import.meta.env.VITE_MODE,
  BASE_URL: resolveBaseUrl(),
  // The public storefront. Read by the account menu's "Preview portal", which is
  // a one-way look at the customer-facing site — never a role change.
  FRONTEND_URL: import.meta.env.VITE_FRONTEND_URL,
};
export default config;
