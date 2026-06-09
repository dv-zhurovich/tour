import React, { createContext, useContext, useState, useEffect } from "react";

// Контекст хранит текущего клиента и делает авторизацию доступной всем страницам.
const ClientContext = createContext(null);

export function ClientProvider({ children }) {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // При старте приложения проверяем серверную сессию клиента.
    fetch("/api/client/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setClient(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const logout = async () => {
    // Выход очищает серверную сессию и локальное состояние React.
    await fetch("/api/client/logout", {
      method: "POST",
      credentials: "include",
    });
    setClient(null);
  };

  return (
    <ClientContext.Provider value={{ client, setClient, logout, loading }}>
      {children}
    </ClientContext.Provider>
  );
}

export const useClient = () => useContext(ClientContext);
