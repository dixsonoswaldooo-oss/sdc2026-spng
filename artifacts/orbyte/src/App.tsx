import { Route, Router, Switch } from 'wouter';
import AiTestPage from './pages/ai-test';
import { ScaffoldCheckPage } from './pages/scaffold-check';

export default function App() {
  return (
    <Router base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Switch>
        <Route path="/tes-ai" component={AiTestPage} />
        <Route path="/" component={ScaffoldCheckPage} />
        <Route>
          <AiTestPage />
        </Route>
      </Switch>
    </Router>
  );
}
