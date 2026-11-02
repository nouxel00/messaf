import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { EspaceRH } from './components/layout/EspaceRH';
import { RouteProtegee } from './components/navigation/RouteProtegee';
import { AuthProvider } from './contexts/AuthContext';
import { ConnexionPage } from './pages/auth/ConnexionPage';
import { ConfirmationCreationPage } from './pages/agents/ConfirmationCreationPage';
import { CreationAgentPage } from './pages/agents/CreationAgentPage';
import { DetailAgentPage } from './pages/agents/DetailAgentPage';
import { ListeAgentsPage } from './pages/agents/ListeAgentsPage';
import { TableauDeBordPage } from './pages/dashboard/TableauDeBordPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/connexion" element={<ConnexionPage />} />
          <Route element={<RouteProtegee />}>
            <Route element={<EspaceRH />}>
              <Route index element={<TableauDeBordPage />} />
              <Route path="agents" element={<ListeAgentsPage />} />
              <Route path="agents/nouveau" element={<CreationAgentPage />} />
              <Route path="agents/:matricule" element={<DetailAgentPage />} />
              <Route path="agents/:matricule/creation-confirmee" element={<ConfirmationCreationPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
