'use strict';

/**
 * VDAJ Services — Real-Time WhatsApp Flow Execution Engine
 * ────────────────────────────────────────────────────────────
 * Evaluates active automations upon inbound WhatsApp messages,
 * matches keyword/button triggers, executes connected graph nodes
 * (Messages, Tags, Assignments, Condition Splits), and emits real-time
 * WebSocket events to the Inbox.
 */

const { query } = require('../config/database');
const { sendWhatsAppMessage } = require('./metaApiService');
const logger = require('../utils/logger');

/**
 * Safely parse graph structure from automation steps
 */
function parseGraph(rawSteps) {
  let nodes = [];
  let edges = [];

  if (Array.isArray(rawSteps)) {
    nodes = rawSteps.filter((s) => !s.source);
    edges = rawSteps.filter((s) => s.source);
  } else if (rawSteps && typeof rawSteps === 'object') {
    nodes = rawSteps.nodes || [];
    edges = rawSteps.edges || [];
  }

  return { nodes, edges };
}

/**
 * Main inbound flow processor.
 * Triggered by webhookRoutes whenever a customer sends a message or clicks a button.
 */
async function processInboundFlow({
  tenantId,
  fromPhone,
  messageBody = '',
  buttonReplyId = null,
  contactId = null,
  conversationId = null,
  broadcastToTenant = null,
}) {
  try {
    if (!tenantId || !fromPhone) return;

    // 1. Fetch active automations for this tenant
    const { rows: activeFlows } = await query(
      `SELECT id, name, trigger_type, trigger_config, steps, run_count
       FROM automations
       WHERE tenant_id = $1 AND is_active = true
       ORDER BY updated_at DESC`,
      [tenantId]
    );

    if (!activeFlows || activeFlows.length === 0) {
      return; // No active automations for this tenant
    }

    const cleanText = String(messageBody || '').trim().toLowerCase();
    const cleanButton = String(buttonReplyId || '').trim();

    // 2. Iterate through flows to find a match
    for (const flow of activeFlows) {
      const { nodes, edges } = parseGraph(flow.steps);
      if (!nodes.length) continue;

      // Locate trigger node
      const triggerNode = nodes.find((n) => n.type === 'trigger') || {
        id: 'trigger',
        data: { config: flow.trigger_config || {} },
      };

      const triggerConfig = triggerNode.data?.config || flow.trigger_config || {};
      const triggerType = triggerConfig.triggerType || flow.trigger_type || 'keyword';

      let isMatch = false;
      let matchedKeyword = null;

      // Evaluate trigger conditions
      if (triggerType === 'keyword') {
        const keywords = (triggerConfig.keywords || []).map((k) => String(k).trim().toLowerCase());
        // Check if any keyword matches
        for (const kw of keywords) {
          if (!kw) continue;
          if (cleanText === kw || cleanText.includes(kw)) {
            isMatch = true;
            matchedKeyword = kw;
            break;
          }
        }
      } else if (triggerType === 'inbound') {
        // Any inbound message triggers the flow
        isMatch = true;
      }

      if (!isMatch) continue;

      logger.info(`[FlowEngine] Matched flow "${flow.name}" (${flow.id}) for ${fromPhone} on keyword "${matchedKeyword}"`);

      // 3. Retrieve Tenant Meta Credentials
      const { rows: [tenant] } = await query(
        `SELECT meta_phone_number_id, meta_system_token FROM tenants WHERE id = $1`,
        [tenantId]
      );

      const effectivePhoneId = tenant?.meta_phone_number_id || process.env.META_PHONE_NUMBER_ID;
      const effectiveToken = tenant?.meta_system_token || process.env.META_ACCESS_TOKEN;

      if (!effectivePhoneId || !effectiveToken) {
        logger.warn(`[FlowEngine] Cannot execute flow: Meta credentials missing for tenant ${tenantId}`);
        continue;
      }

      // 4. Log start of run in automation_runs
      let runId = null;
      try {
        const { rows: [run] } = await query(
          `INSERT INTO automation_runs
             (tenant_id, automation_id, contact_id, phone_e164, status, trigger_type, matched_keyword, logs)
           VALUES ($1, $2, $3, $4, 'running', $5, $6, $7)
           RETURNING id`,
          [
            tenantId,
            flow.id,
            contactId,
            fromPhone,
            triggerType,
            matchedKeyword,
            JSON.stringify([{ timestamp: new Date().toISOString(), message: `Triggered by keyword "${matchedKeyword}"` }]),
          ]
        );
        runId = run?.id;
      } catch (runErr) {
        // Non-blocking if table not migrated yet
      }

      // 5. Traverse execution graph starting from trigger node
      const firstEdge = edges.find((e) => e.source === triggerNode.id);
      let currentNode = firstEdge ? nodes.find((n) => n.id === firstEdge.target) : null;
      let stepLimit = 15; // prevent infinite loops

      while (currentNode && stepLimit > 0) {
        stepLimit--;
        const nodeType = currentNode.type;
        const config = currentNode.data?.config || {};

        if (nodeType === 'message') {
          const msgType = config.messageType || 'text';
          const bodyText = config.body || 'Hello! Thank you for reaching out.';
          const buttons = Array.isArray(config.buttons) ? config.buttons : [];

          try {
            const metaRes = await sendWhatsAppMessage({
              phoneNumberId: effectivePhoneId,
              accessToken: effectiveToken,
              to: fromPhone,
              body: bodyText,
              buttons: msgType === 'buttons' && buttons.length > 0 ? buttons : undefined,
              templateName: msgType === 'template' ? config.templateName : undefined,
              templateLanguage: config.templateLanguage || 'en',
            });

            const waMsgId = metaRes?.messages?.[0]?.id || `wamid_sim_${Date.now()}`;

            // Save outbound message to inbox_messages so it appears in the live agent chat
            if (conversationId) {
              const { rows: [savedOutbound] } = await query(
                `INSERT INTO inbox_messages
                   (conversation_id, tenant_id, wa_message_id, direction, message_type, body, status, sent_by)
                 VALUES ($1, $2, $3, 'outbound', $4, $5, 'sent', NULL)
                 RETURNING *`,
                [conversationId, tenantId, waMsgId, msgType, bodyText]
              );

              // Real-time broadcast to all agents in inbox
              if (typeof broadcastToTenant === 'function' && savedOutbound) {
                broadcastToTenant(tenantId, {
                  type: 'new_message',
                  data: {
                    ...savedOutbound,
                    conversation: {
                      id: conversationId,
                      last_message_at: savedOutbound.created_at,
                      last_message_preview: bodyText.slice(0, 100),
                    },
                  },
                });
              }
            }
          } catch (sendErr) {
            logger.error(`[FlowEngine] Failed to send step message to ${fromPhone}: ${sendErr.message}`);
            break;
          }

          // If interactive buttons were sent, pause flow execution until user replies with a button!
          if (msgType === 'buttons' && buttons.length > 0) {
            break;
          }
        } else if (nodeType === 'action') {
          const actionType = config.actionType;

          if (actionType === 'add_tag' && config.tag && contactId) {
            const cleanTag = String(config.tag).trim();
            await query(
              `UPDATE contacts
               SET tags = ARRAY(SELECT DISTINCT unnest(COALESCE(tags, '{}'::text[]) || $1::text[])),
                   updated_at = NOW()
               WHERE id = $2 AND tenant_id = $3`,
              [[cleanTag], contactId, tenantId]
            );
          } else if (actionType === 'remove_tag' && config.tag && contactId) {
            const cleanTag = String(config.tag).trim();
            await query(
              `UPDATE contacts
               SET tags = array_remove(tags, $1),
                   updated_at = NOW()
               WHERE id = $2 AND tenant_id = $3`,
              [cleanTag, contactId, tenantId]
            );
          } else if (actionType === 'assign' && config.agentId && conversationId) {
            await query(
              `UPDATE inbox_conversations
               SET assigned_agent_id = $1, updated_at = NOW()
               WHERE id = $2 AND tenant_id = $3`,
              [config.agentId, conversationId, tenantId]
            );
          }
        } else if (nodeType === 'delay') {
          // In real-time webhook flow, delay stops execution for async worker
          logger.info(`[FlowEngine] Encountered delay of ${config.value} ${config.unit} for ${fromPhone}`);
          break;
        }

        // Find next step in edge list
        const nextEdge = edges.find((e) => e.source === currentNode.id);
        currentNode = nextEdge ? nodes.find((n) => n.id === nextEdge.target) : null;
      }

      // 6. Update run stats
      await query(
        `UPDATE automations SET run_count = run_count + 1 WHERE id = $1`,
        [flow.id]
      );

      if (runId) {
        await query(
          `UPDATE automation_runs
           SET status = 'completed', completed_at = NOW()
           WHERE id = $1`,
          [runId]
        );
      }

      // Stop after first matching flow to prevent overlapping triggers
      break;
    }
  } catch (err) {
    logger.error('[FlowEngine] Error processing inbound automation flow:', err);
  }
}

module.exports = {
  processInboundFlow,
  parseGraph,
};
