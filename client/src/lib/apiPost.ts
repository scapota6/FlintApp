// shared POST helper
import { getCsrfToken, invalidateCsrf } from '@/lib/csrf';
import { requestJSON } from '@/lib/http';

export async function apiPost(path: string, body: any) {
  let token = await getCsrfToken();
  
  try {
    // Use the defensive requestJSON helper
    return await requestJSON(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,   // csurf default header
      },
      body: JSON.stringify(body),
    });
  } catch (error: any) {
    // If server restarted or cookie rotated, token may be stale—refresh once
    if (error.message?.includes('403') || error.message?.includes('CSRF')) {
      invalidateCsrf();
      token = await getCsrfToken();
      
      return await requestJSON(path, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'x-csrf-token': token 
        },
        body: JSON.stringify(body),
      });
    }
    throw error;
  }
}

/**
 * Helper function for making CSRF-protected PUT requests
 */
export async function apiPut(path: string, body: any) {
  let token = await getCsrfToken();
  
  try {
    return await requestJSON(path, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': token,
      },
      body: JSON.stringify(body),
    });
  } catch (error: any) {
    if (error.message?.includes('403') || error.message?.includes('CSRF')) {
      invalidateCsrf();
      token = await getCsrfToken();
      
      return await requestJSON(path, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
        },
        body: JSON.stringify(body),
      });
    }
    throw error;
  }
}

/**
 * Helper function for making CSRF-protected DELETE requests
 */
export async function apiDelete(path: string) {
  let token = await getCsrfToken();
  
  try {
    return await requestJSON(path, {
      method: 'DELETE',
      headers: {
        'x-csrf-token': token,
      },
    });
  } catch (error: any) {
    if (error.message?.includes('403') || error.message?.includes('CSRF')) {
      invalidateCsrf();
      token = await getCsrfToken();
      
      return await requestJSON(path, {
        method: 'DELETE',
        headers: {
          'x-csrf-token': token,
        },
      });
    }
    throw error;
  }
}