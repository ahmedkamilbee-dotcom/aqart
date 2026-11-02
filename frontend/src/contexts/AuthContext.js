import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

axios.defaults.withCredentials = true;

// إضافة التوكن تلقائياً في رأس كل طلب يخرج من الموقع
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// تجديد الجلسة تلقائياً في الخلفية عند انتهاء التوكن (15 دقيقة) دون تسجيل خروج المستخدم
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
      const refreshToken = localStorage.getItem('refresh_token');

      if (!refreshToken) {
        localStorage.removeItem('access_token');
        return Promise.reject(error);
      }

      try {
        refreshPromise =
          refreshPromise ||
          axios.post(
            `${API}/auth/refresh`,
            {},
            {
              headers: { Authorization: `Bearer ${refreshToken}` },
              withCredentials: true,
            }
          );

        const { data } = await refreshPromise;

        if (data?.access_token) {
          localStorage.setItem('access_token', data.access_token);
        }
        if (data?.refresh_token) {
          localStorage.setItem('refresh_token', data.refresh_token);
        }

        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${data.access_token || localStorage.getItem('access_token')}`;
        return axios(original);
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
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
    const token = localStorage.getItem('access_token');
    if (!token) {
      setUser(false);
      setLoading(false);
      return;
    }

    try {
      const { data } = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
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
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
    }
    if (data.refresh_token) {
      localStorage.setItem('refresh_token', data.refresh_token);
    }
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

    const { data } = await axios.post(`${API}/auth/register`, payload, {
      withCredentials: true,
    });
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
    }
    if (data.refresh_token) {
      localStorage.setItem('refresh_token', data.refresh_token);
    }
    setUser(data);
    return data;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (e) {
      // تجاهل الخطأ في حال كانت الجلسة منتهية مسبقاً
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(false);
    }
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