/**
 * Edge Function: get-client-info
 * 
 * Extracts real client information from request headers.
 * Designed for admin panel security logging.
 * 
 * SECURITY:
 * - Read-only, no data storage
 * - No authentication required (safe public endpoint)
 * - Works behind proxies (Cloudflare, Nginx, etc.)
 * - Graceful fallbacks for all values
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Extract real client IP from headers
 * Priority: x-forwarded-for > cf-connecting-ip > x-real-ip > fallback
 */
function extractClientIP(headers: Headers): string {
  // 1. X-Forwarded-For (standard proxy header)
  // Format: "client, proxy1, proxy2" - take first (original client)
  const xForwardedFor = headers.get('x-forwarded-for')
  if (xForwardedFor) {
    const firstIP = xForwardedFor.split(',')[0].trim()
    if (isValidIP(firstIP)) {
      return firstIP
    }
  }

  // 2. CF-Connecting-IP (Cloudflare)
  const cfConnectingIP = headers.get('cf-connecting-ip')
  if (cfConnectingIP && isValidIP(cfConnectingIP)) {
    return cfConnectingIP
  }

  // 3. X-Real-IP (Nginx)
  const xRealIP = headers.get('x-real-ip')
  if (xRealIP && isValidIP(xRealIP)) {
    return xRealIP
  }

  // 4. True-Client-IP (Akamai, Cloudflare Enterprise)
  const trueClientIP = headers.get('true-client-ip')
  if (trueClientIP && isValidIP(trueClientIP)) {
    return trueClientIP
  }

  // 5. X-Client-IP (some proxies)
  const xClientIP = headers.get('x-client-ip')
  if (xClientIP && isValidIP(xClientIP)) {
    return xClientIP
  }

  // Fallback for local development
  return '127.0.0.1'
}

/**
 * Basic IP validation (IPv4 and IPv6)
 */
function isValidIP(ip: string): boolean {
  if (!ip || ip.length < 3) return false
  
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/
  if (ipv4Pattern.test(ip)) {
    const parts = ip.split('.').map(Number)
    return parts.every(part => part >= 0 && part <= 255)
  }
  
  // IPv6 pattern (simplified)
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/
  if (ipv6Pattern.test(ip)) {
    return true
  }
  
  // Localhost variations
  if (ip === 'localhost' || ip === '::1') {
    return true
  }
  
  return false
}

/**
 * Sanitize string to prevent injection
 */
function sanitize(value: string | null, maxLength: number = 500): string {
  if (!value) return ''
  return value.substring(0, maxLength).replace(/[<>]/g, '')
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const headers = req.headers

    // Extract client information
    const clientInfo = {
      // Real IP address
      ip_address: extractClientIP(headers),
      
      // User agent (browser/device info)
      user_agent: sanitize(headers.get('user-agent'), 500) || 'unknown',
      
      // Preferred language
      language: sanitize(headers.get('accept-language'), 100) || 'unknown',
      
      // Referrer (where user came from)
      referrer: sanitize(headers.get('referer') || headers.get('referrer'), 200) || '',
      
      // Additional context (optional)
      metadata: {
        // Cloudflare specific
        country: headers.get('cf-ipcountry') || null,
        ray_id: headers.get('cf-ray') || null,
        
        // Request timestamp
        timestamp: new Date().toISOString(),
      }
    }

    return new Response(
      JSON.stringify(clientInfo),
      {
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  } catch (error) {
    console.error('get-client-info error:', error)
    
    // Graceful fallback - never fail the request
    return new Response(
      JSON.stringify({
        ip_address: '0.0.0.0',
        user_agent: 'unknown',
        language: 'unknown',
        referrer: '',
        metadata: {
          error: true,
          timestamp: new Date().toISOString(),
        }
      }),
      {
        status: 200, // Return 200 even on error to not break client
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    )
  }
})
