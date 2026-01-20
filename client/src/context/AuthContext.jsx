import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  // Handle session expired from another device
  const handleSessionExpired = useCallback((message) => {
    setUser(null);
    localStorage.removeItem('user');
    sessionStorage.setItem('logout_message', message);
    window.location.href = '/login';
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedAdmin = localStorage.getItem('admin');
    
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    if (storedAdmin) {
      setAdmin(JSON.parse(storedAdmin));
    }
    setLoading(false);
  }, []);

  // Setup axios interceptor for session expired errors
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && error.response?.data?.code === 'SESSION_EXPIRED_OTHER_DEVICE') {
          handleSessionExpired(error.response.data.message);
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [handleSessionExpired]);

  const loginUser = async (email, password) => {
    const { data } = await axios.post('/api/user/login', { email, password });
    setUser(data);
    localStorage.setItem('user', JSON.stringify(data));
    return data;
  };

  const registerUser = async (userData) => {
    const { data } = await axios.post('/api/user/register', userData);
    setUser(data);
    localStorage.setItem('user', JSON.stringify(data));
    return data;
  };

  const registerDemoUser = async (userData) => {
    const { data } = await axios.post('/api/user/demo-register', userData);
    setUser(data);
    localStorage.setItem('user', JSON.stringify(data));
    return data;
  };

  const loginAdmin = async (email, password) => {
    const { data } = await axios.post('/api/admin/login', { email, password });
    setAdmin(data);
    localStorage.setItem('admin', JSON.stringify(data));
    return data;
  };

  const setupAdmin = async (username, email, password) => {
    const { data } = await axios.post('/api/admin/setup', { username, email, password });
    setAdmin(data);
    localStorage.setItem('admin', JSON.stringify(data));
    return data;
  };

  const logoutUser = (message = null) => {
    setUser(null);
    localStorage.removeItem('user');
    if (message) {
      // Store message to show on login page
      sessionStorage.setItem('logout_message', message);
    }
  };

  const logoutAdmin = () => {
    setAdmin(null);
    localStorage.removeItem('admin');
  };

  // Function to update admin data (e.g., after wallet transactions)
  const updateAdmin = (updates) => {
    const updatedAdmin = { ...admin, ...updates };
    setAdmin(updatedAdmin);
    localStorage.setItem('admin', JSON.stringify(updatedAdmin));
  };

  // Function to update user data (e.g., after profile updates)
  const updateUser = (updates) => {
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const value = {
    user,
    admin,
    setAdmin,
    loading,
    loginUser,
    registerUser,
    registerDemoUser,
    loginAdmin,
    setupAdmin,
    logoutUser,
    logoutAdmin,
    updateAdmin,
    updateUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
