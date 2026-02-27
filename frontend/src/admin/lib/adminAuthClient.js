// Thin shim to expose only admin auth helpers to the admin UI.
// Prevents importing the full adminSupabase surface elsewhere.
import { adminAuth } from './adminSupabase';

export { adminAuth };

export default { adminAuth };
