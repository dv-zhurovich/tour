import React from "react";
import { Routes, Route } from "react-router-dom";
import { ClientProvider } from "./context/ClientContext";
import HomePage from "./pages/HomePage";
import AdminLogin from "./pages/AdminLogin";
import AdminPanel from "./pages/AdminPanel";
import ClientLogin from "./pages/ClientLogin";
import ClientRegister from "./pages/ClientRegister";
import ClientDashboard from "./pages/ClientDashboard";
import NewsPage from "./pages/NewsPage";
import ArticlesPage from "./pages/ArticlesPage";

export default function App() {
  return (
    <ClientProvider>
      {/* Центральная карта маршрутов приложения: публичные страницы, кабинет клиента и админ-панель. */}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<ClientLogin />} />
        <Route path="/register" element={<ClientRegister />} />
        <Route path="/dashboard/*" element={<ClientDashboard />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/*" element={<AdminPanel />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/articles" element={<ArticlesPage />} />
      </Routes>
    </ClientProvider>
  );
}
