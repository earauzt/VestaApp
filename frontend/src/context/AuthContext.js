import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { AUTH_ME_PATH, householdAuthHeaders, isHouseholdSessionPayload } from "../utils/householdSession";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

axios.defaults.withCredentials = true;

const AuthContext = createContext(null);

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

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Backend get_current_user always returns Emilio — this IS the session.
        const response = await axios.get(`${API}${AUTH_ME_PATH}`);
        if (isHouseholdSessionPayload(response.data)) {
          setUser(response.data);
        }
      } catch {
        // A failed /auth/me is not "logged out". Do not send Emilio to /login.
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const getAuthHeaders = () => householdAuthHeaders();

  return (
    <AuthContext.Provider value={{
      user,
      token: null,
      loading,
      getAuthHeaders,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
