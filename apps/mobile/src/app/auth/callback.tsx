import { Redirect } from 'expo-router';

// AuthProvider consumes the deep-link code before this route is rendered.
export default function AuthCallbackRoute() {
  return <Redirect href="/" />;
}
