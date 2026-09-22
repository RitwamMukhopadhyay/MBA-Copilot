/**
 * Centralized API configuration for MBA Copilot.
 * Supports dynamic resolution of backend URLs to allow local and LAN access.
 */

const getHostIp = () => {
  // If we are on localhost/127.0.0.1, we return localhost
  // If we are accessed via LAN (e.g. 192.168.1.123), we return that IP
  return window.location.hostname;
};

export const BACKEND_PORT = "8000";
export const FRONTEND_PORT = "5173";

export const getBackendBaseUrl = () => {
  return `http://${getHostIp()}:${BACKEND_PORT}`;
};

export const getFrontendBaseUrl = () => {
  return `http://${getHostIp()}:${FRONTEND_PORT}`;
};

export const getApiUrl = (path) => {
  // strip leading slash if present
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${getBackendBaseUrl()}/${cleanPath}`;
};

export default {
  getBackendBaseUrl,
  getFrontendBaseUrl,
  getApiUrl,
  BACKEND_PORT,
  FRONTEND_PORT
};
