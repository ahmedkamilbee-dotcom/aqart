import React from 'react';
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthPage } from "./pages/AuthPage";
import { Dashboard, SoldProperties, RentedProperties } from "./pages/Dashboard";
import { AddProperty } from "./pages/AddProperty";
import { AdminDashboard } from "./pages/AdminDashboard";
import { PropertyDetails } from "./pages/PropertyDetails";
import { EditProperty } from "./pages/EditProperty";
import { Subscriptions } from "./pages/Subscriptions";
import { LeadsPage } from "./pages/LeadsPage";
import { CalendarPage } from "./pages/CalendarPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { LandingPage } from "./pages/LandingPage";
import { PublicPropertyPage } from "./pages/PublicPropertyPage";
import { ContactFooter } from "./components/ContactFooter";
import { BottomNav } from "./components/BottomNav";
import { SubscriptionNudgeModal } from "./components/SubscriptionBanner";

function GlobalFooter() {
  const location = useLocation();
  const { user } = useAuth();
  // Public and auth routes use their own focused layouts.
  if (!user || location.pathname === '/auth' || location.pathname === '/' || location.pathname.startsWith('/share/')) return null;
  return (
    <>
      <SubscriptionNudgeModal />
      <ContactFooter />
      <BottomNav />
    </>
  );
}

function App() {
  return (
    <div className="App" dir="rtl">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/share/:token" element={<PublicPropertyPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sold"
              element={
                <ProtectedRoute>
                  <SoldProperties />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rented"
              element={
                <ProtectedRoute>
                  <RentedProperties />
                </ProtectedRoute>
              }
            />
            <Route
              path="/add-property"
              element={
                <ProtectedRoute>
                  <AddProperty />
                </ProtectedRoute>
              }
            />
            <Route
              path="/property/:id"
              element={
                <ProtectedRoute>
                  <PropertyDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/edit-property/:id"
              element={
                <ProtectedRoute>
                  <EditProperty />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <CalendarPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leads"
              element={
                <ProtectedRoute>
                  <LeadsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/subscriptions"
              element={
                <ProtectedRoute>
                  <Subscriptions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <GlobalFooter />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
