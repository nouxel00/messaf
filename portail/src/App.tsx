import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { EspaceRH } from './components/layout/EspaceRH';
import { ExigerRole } from './components/navigation/ExigerRole';
import { RouteProtegee } from './components/navigation/RouteProtegee';
import { ROLES_ABSENCES, ROLES_AUDIT, ROLES_CONSULTATION, ROLES_ENROLEMENT, ROLES_PASSATION } from './config/messaf';
import { AuthProvider } from './contexts/AuthContext';
import { ConnexionPage } from './pages/auth/ConnexionPage';
import { ConfirmationCreationPage } from './pages/agents/ConfirmationCreationPage';
import { CreationAgentPage } from './pages/agents/CreationAgentPage';
import { DetailAgentPage } from './pages/agents/DetailAgentPage';
import { ListeAgentsPage } from './pages/agents/ListeAgentsPage';
import { AccueilPage } from './pages/AccueilPage';
import { AbsencesPage } from './pages/absences/AbsencesPage';
import { JournalAuditPage } from './pages/audit/JournalAuditPage';
import { FonctionsPage } from './pages/fonctions/FonctionsPage';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/connexion" element={<ConnexionPage />} />
          <Route element={<RouteProtegee />}>
            <Route element={<EspaceRH />}>
              {/* Première page selon le rôle */}
              <Route index element={<AccueilPage />} />
              <Route element={<ExigerRole roles={ROLES_CONSULTATION} />}>
                <Route path="agents" element={<ListeAgentsPage />} />
                <Route path="agents/:matricule" element={<DetailAgentPage />} />
              </Route>
              <Route element={<ExigerRole roles={ROLES_ENROLEMENT} />}>
                <Route path="agents/nouveau" element={<CreationAgentPage />} />
                <Route path="agents/:matricule/creation-confirmee" element={<ConfirmationCreationPage />} />
              </Route>
              <Route element={<ExigerRole roles={ROLES_AUDIT} />}>
                <Route path="audit" element={<JournalAuditPage />} />
              </Route>
              <Route element={<ExigerRole roles={ROLES_PASSATION} />}>
                <Route path="fonctions" element={<FonctionsPage />} />
              </Route>
              <Route element={<ExigerRole roles={ROLES_ABSENCES} />}>
                <Route path="absences" element={<AbsencesPage />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
