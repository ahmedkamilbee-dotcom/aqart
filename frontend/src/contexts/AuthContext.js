import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

axios.defaults.withCredentials = true;

// تجديد الجلسة تلقائياً: التوكن القصير (15 دقيقة) ينتهي، فنستدعي /auth/refresh مرة واحدة ثم نعيد الطلب
let refreshPromise = null;
axios.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url = original?.url || '';
    const isAuthCall =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/logout');

    if (status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      try {
        refreshPromise = refreshPromise || axios.post(`${API}/auth/refresh`, {}, { withCredentials: true });
        await refreshPromise;
        return axios(original);
      } catch (refreshError) {
        return Promise.reject(error);
      } finally {
        refreshPromise = null;
      }
    }
    return Promise.reject(error);
  }
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const { data } = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(data);
    } catch (error) {
      setUser(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (identifier, password) => {
    const { data } = await axios.post(
      `${API}/auth/login`,
      { identifier, password },
      { withCredentials: true }
    );
    setUser(data);
    return data;
  };

  const register = async (name, identifier, password, officeName) => {
    const payload = { name, password };
    if (identifier.includes('@')) {
      payload.email = identifier;
    } else {
      payload.phone = identifier;
    }
    if (officeName) {
      payload.office_name = officeName;
    }

    const { data } = await axios.post(
      `${API}/auth/register`,
      payload,
      { withCredentials: true }
    );
    setUser(data);
    return data;
  };

  const logout = async () => {
    await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
