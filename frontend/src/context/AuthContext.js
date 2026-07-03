import { createContext, useContext, useState, useEffect, useRef } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Configure axios to always send cookies
axios.defaults.withCredentials = true;

const AuthContext = createContext(null);

const SESSION_EXPIRED_PARAM = "session_expired";

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // Global 401 handling: if a request fails with 401 while we believe the
  // user is logged in, the session expired server-side (cookie expired/revoked).
  // Clear local auth state and redirect to /login with a friendly message.
  // Login/register/auth-me requests are excluded since a 401 there just means
  // "not authenticated yet" / "bad credentials", not an expired session.
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error.response?.status;
        const url = error.config?.url || "";
        const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/register") || url.includes("/auth/me");

        if (status === 401 && !isAuthEndpoint && userRef.current) {
          setUser(null);
          setToken(null);
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
            window.location.href = `/login?${SESSION_EXPIRED_PARAM}=1`;
          }
        }

        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Cookie is sent automatically via withCredentials
        const response = await axios.get(`${API}/auth/me`);
        setUser(response.data);
      } catch {
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { access_token, user: userData } = response.data;
    // Keep token in memory for backward-compat getAuthHeaders
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const register = async (name, email, password, role = "spouse") => {
    const response = await axios.post(`${API}/auth/register`, { 
      name, 
      email, 
      password, 
      role 
    });
    const { access_token, user: userData } = response.data;
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('Logout request failed:', err);
    }
    setToken(null);
    setUser(null);
  };

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${token}`
  });

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      login, 
      register, 
      logout, 
      getAuthHeaders 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
