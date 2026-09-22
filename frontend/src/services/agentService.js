/**
 * Agent Service - Shared service for calling the MBA Copilot backend agent
 * 
 * Used by both Chat.jsx and AIAssistant.jsx (Sidebar)
 * Ensures consistent API calls and error handling
 */

import { getApiUrl } from './config.js';

const AGENT_API_URL = getApiUrl('/chat/agent');

/**
 * Call the backend agent with a user message
 * 
 * @param {string} message - The user's message
 * @returns {Promise<{response: string, success: boolean, error?: string}>}
 */
export async function callAgent(message) {
  if (!message || message.trim().length === 0) {
    return {
      response: 'Please enter a message.',
      success: false,
      error: 'Empty message'
    };
  }

  try {
    console.log('[AGENT_SERVICE] Calling backend agent:', message);
    
    const response = await fetch(AGENT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: message.trim() })
    });

    if (!response.ok) {
      console.error('[AGENT_SERVICE] HTTP error:', response.status, response.statusText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('[AGENT_SERVICE] Response received:', {
      hasResponse: !!data.response,
      usedAgent: data.used_agent,
      toolsUsed: data.tools_used,
      actionType: data.action_type
    });

    return {
      response: data.response || 'No response from agent',
      success: true,
      data: data
    };
  } catch (error) {
    console.error('[AGENT_SERVICE] Error:', error.message);
    return {
      response: `Sorry, there was an error: ${error.message}`,
      success: false,
      error: error.message
    };
  }
}

/**
 * Call the regular chat endpoint (without agent tool enhancement)
 * 
 * @param {string} message - The user's message
 * @returns {Promise<{response: string, success: boolean, error?: string}>}
 */
export async function callChatDirect(message) {
  if (!message || message.trim().length === 0) {
    return {
      response: 'Please enter a message.',
      success: false,
      error: 'Empty message'
    };
  }

  try {
    console.log('[AGENT_SERVICE] Calling direct chat endpoint:', message);
    
    const response = await fetch(getApiUrl('/chat'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: message.trim() })
    });

    if (!response.ok) {
      console.error('[AGENT_SERVICE] HTTP error:', response.status, response.statusText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('[AGENT_SERVICE] Direct chat response received');

    return {
      response: data.response || 'No response from chat',
      success: true
    };
  } catch (error) {
    console.error('[AGENT_SERVICE] Error:', error.message);
    return {
      response: `Sorry, there was an error: ${error.message}`,
      success: false,
      error: error.message
    };
  }
}

export default {
  callAgent,
  callChatDirect
};
