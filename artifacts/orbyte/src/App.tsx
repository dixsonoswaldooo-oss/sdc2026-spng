import { Redirect, Route, Router, Switch } from 'wouter';
import { CashGuardLayout } from './features/cash-guard/CashGuardLayout';
import { OrbyteShell } from './layout/OrbyteShell';
import { PlaceholderPage } from './layout/PlaceholderPage';
import { RoleProvider } from './layout/RoleProvider';
import { MODULES } from './layout/Sidebar';
import AiTestPage from './pages/ai-test';

export default function App() {
  return (
    <Router base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Switch>
        <Route path="/tes-ai" component={AiTestPage} />
        <Route path="/">
          <Redirect to="/cash-guard" />
        </Route>
        <Route>
          <RoleProvider>
            <OrbyteShell>
              <Switch>
                <Route path="/cash-guard" nest>
                  <CashGuardLayout />
                </Route>
                <Route path="/:module">
                  {(params) => (
                    <PlaceholderPage
                      title={MODULES.find((m) => m.path === `/${params.module}`)?.label ?? 'Page not found'}
                      message="Not part of this demo. This mock Orbyte workspace only runs the Cash Guard feature."
                    />
                  )}
                </Route>
              </Switch>
            </OrbyteShell>
          </RoleProvider>
        </Route>
      </Switch>
    </Router>
  );
}
