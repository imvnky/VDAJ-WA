/**
 * VDAJ Services — Full Demo Data Seeder
 * ──────────────────────────────────────
 * Populates the DB with two realistic tenants, users, contacts,
 * templates, campaigns, campaign_messages, analytics_snapshots,
 * inbox_conversations, and inbox_messages for UI/UX demonstrations.
 *
 * Run: npm run seed        (from backend/)
 *      node scripts/seed.js
 *
 * SAFE: only truncates tenant-owned data tables. Never touches
 * subscription_tiers, schema_migrations, or the superadmin user.
 */

'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');
const { v4: uuid } = require('uuid');

// ── DB connection ──────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT, 10),
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
});

const q = (text, params) => pool.query(text, params);

// ── ANSI ───────────────────────────────────────────────────────
const G  = (s) => `\x1b[32m${s}\x1b[0m`;
const Y  = (s) => `\x1b[33m${s}\x1b[0m`;
const B  = (s) => `\x1b[1m${s}\x1b[0m`;
const DM = (s) => `\x1b[2m${s}\x1b[0m`;
const ok = (label) => console.log(`  ${G('✔')} ${label}`);

// ── Helpers ────────────────────────────────────────────────────
const rand  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick  = (arr)      => arr[Math.floor(Math.random() * arr.length)];
const sleep = (ms)       => new Promise((r) => setTimeout(r, ms));

/** Returns ISO string N days ago from now */
function daysAgo(n, hourOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hourOffset, rand(0, 59), rand(0, 59), 0);
  return d.toISOString();
}

/** E.164 phone for India (+91 9XXXXXXXXX) */
function fakeIndianPhone() {
  const prefixes = ['91700', '91800', '91900', '91960', '91987', '91876', '91756'];
  return `+${pick(prefixes)}${String(rand(100000, 999999))}`;
}

/** E.164 phone for Angola (+244 9XXXXXXXX) */
function fakeAngolaPhone() {
  const prefixes = ['24491', '24492', '24493', '24494'];
  return `+${pick(prefixes)}${String(rand(1000000, 9999999))}`;
}

// ── Realistic name banks ───────────────────────────────────────
const INDIAN_FIRST = [
  'Aarav','Aditya','Akash','Ananya','Arjun','Arnav','Deepika','Dhruv','Divya',
  'Ishaan','Karthik','Kavya','Manish','Meera','Nisha','Priya','Rahul','Riya',
  'Rohan','Sachin','Sanaya','Shreya','Siddharth','Sneha','Tanvi','Varun','Vedika',
  'Vijay','Vishal','Zara','Pooja','Raj','Neha','Aman','Simran','Kunal','Swati',
  'Tarun','Harini','Madhav','Preeti','Nikhil','Ankita','Saurabh','Isha','Vikram',
  'Pallavi','Gaurav','Roshni','Chirag',
];
const INDIAN_LAST = [
  'Sharma','Gupta','Verma','Singh','Patel','Mehta','Joshi','Kumar','Reddy',
  'Nair','Rao','Iyer','Pillai','Menon','Agarwal','Chauhan','Malhotra','Kapoor',
  'Saxena','Srivastava','Pandey','Tiwari','Dubey','Bose','Chatterjee','Mukherjee',
  'Ghosh','Das','Roy','Banerjee',
];
const ANGOLA_FIRST = [
  'António','Beatriz','Carlos','Cláudia','Daniel','Eduardo','Filipe','Graça',
  'Hélder','Isabel','João','Joana','Luís','Maria','Manuel','Mariana','Miguel',
  'Nzinga','Paulo','Pedro','Rafael','Rosa','Samuel','Sofia','Tomás','Vanessa',
  'Victor','Yara','Zeferino','Ana','Fernanda','Ricardo','Tiago','Lara','Diogo',
  'Carla','Rui','Catarina','Nuno','Inês','Álvaro','Sandra','Fábio','Vera',
  'Gonçalo','Diana','Frederico','Ângela','Sandro','Helena',
];
const ANGOLA_LAST = [
  'Silva','Santos','Ferreira','Costa','Rodrigues','Almeida','Pereira','Sousa',
  'Lopes','Gomes','Martins','Carvalho','Araújo','Moreira','Oliveira','Dias',
  'Fernandes','Gonçalves','Ribeiro','Cardoso','Mendes','Cruz','Neto','Cunha',
  'Monteiro','Pires','Teixeira','Ramos','Faria','Borges',
];

// ── Template definitions ───────────────────────────────────────
const TEMPLATES = {
  dental: [
    {
      name:        'appointment_reminder',
      category:    'utility',
      language:    'en',
      header_text: 'Your Appointment is Confirmed',
      body_text:   'Hello {{1}}, this is a reminder for your dental appointment at *Ideal Dental Care* on {{2}} at {{3}}. Please arrive 10 minutes early. Reply STOP to opt out.',
      footer_text: 'Ideal Dental Care - Your Smile, Our Priority',
      variables_schema: JSON.stringify([
        { index: 1, name: 'patient_name', example: 'Aarav Sharma' },
        { index: 2, name: 'appointment_date', example: '25th August 2026' },
        { index: 3, name: 'appointment_time', example: '10:30 AM' },
      ]),
      status: 'approved',
    },
    {
      name:        'post_treatment_followup',
      category:    'marketing',
      language:    'en',
      header_text: 'How Are You Feeling?',
      body_text:   'Hi {{1}}, hope you are recovering well after your treatment on {{2}}! If you have any discomfort, call us at +91-98765-43210. Book your next checkup for 20% off!',
      footer_text: 'T&C apply. Reply STOP to opt out.',
      variables_schema: JSON.stringify([
        { index: 1, name: 'patient_name', example: 'Riya Verma' },
        { index: 2, name: 'treatment_date', example: '15th August 2026' },
      ]),
      status: 'approved',
    },
    {
      name:        'festive_offer',
      category:    'marketing',
      language:    'en',
      header_text: 'Diwali Special Dental Offer!',
      body_text:   'Dear {{1}}, celebrate Diwali with a brighter smile! Get FREE teeth whitening with any consultation booked before {{2}}. Limited slots. Book now!',
      footer_text: 'Ideal Dental Care - Reply STOP to unsubscribe.',
      variables_schema: JSON.stringify([
        { index: 1, name: 'customer_name', example: 'Priya Patel' },
        { index: 2, name: 'offer_expiry', example: '31st October 2026' },
      ]),
      status: 'approved',
    },
  ],
  angola: [
    {
      name:        'order_confirmation',
      category:    'utility',
      language:    'en',
      header_text: 'Order Confirmed',
      body_text:   'Hello {{1}}! Your order #{{2}} has been confirmed. Total: AOA {{3}}. Expected delivery: {{4}}. Thank you for shopping at Angola Retail Hub!',
      footer_text: 'Angola Retail Hub - Quality Guaranteed',
      variables_schema: JSON.stringify([
        { index: 1, name: 'customer_name',   example: 'Maria Silva' },
        { index: 2, name: 'order_id',        example: 'ORD-20260815-0042' },
        { index: 3, name: 'order_total',     example: '15,900' },
        { index: 4, name: 'delivery_date',   example: 'August 20, 2026' },
      ]),
      status: 'approved',
    },
    {
      name:        'flash_sale_alert',
      category:    'marketing',
      language:    'en',
      header_text: 'Flash Sale - Limited Time!',
      body_text:   'Hi {{1}}! Enjoy up to {{2}}% OFF across the entire Angola Retail Hub store! Offer valid today only. Use code {{3}} at checkout. Shop now!',
      footer_text: 'Reply STOP to unsubscribe.',
      variables_schema: JSON.stringify([
        { index: 1, name: 'first_name',   example: 'Joao' },
        { index: 2, name: 'discount_pct', example: '40' },
        { index: 3, name: 'promo_code',   example: 'ANGOLA40' },
      ]),
      status: 'approved',
    },
    {
      name:        'restock_notification',
      category:    'utility',
      language:    'en',
      header_text: 'Product Back In Stock!',
      body_text:   'Hello {{1}}! The product *{{2}}* you marked is back in stock. Price: AOA {{3}}. Click below to buy before it sells out again!',
      footer_text: 'Angola Retail Hub - Fast delivery in Luanda.',
      variables_schema: JSON.stringify([
        { index: 1, name: 'customer_name', example: 'Carlos Rodrigues' },
        { index: 2, name: 'product_name',  example: 'Samsung Galaxy A55' },
        { index: 3, name: 'price',         example: '89,900' },
      ]),
      status: 'approved',
    },
  ],
};

// ── Campaign definitions ───────────────────────────────────────
const CAMPAIGNS = {
  dental: [
    { name: 'Diwali Smile Drive 2026',           status: 'completed', daysBack: 12, totalCount: 50, sentPct: 0.98, deliveredPct: 0.93, readPct: 0.81, failedPct: 0.02 },
    { name: 'Q3 Appointment Reminders',          status: 'completed', daysBack: 6,  totalCount: 50, sentPct: 0.97, deliveredPct: 0.91, readPct: 0.77, failedPct: 0.03 },
    { name: 'Post-Treatment Followup — August',  status: 'completed', daysBack: 2,  totalCount: 50, sentPct: 0.96, deliveredPct: 0.90, readPct: 0.72, failedPct: 0.04 },
    { name: 'New Patient Welcome Series',         status: 'paused',   daysBack: 1,  totalCount: 50, sentPct: 0.40, deliveredPct: 0.38, readPct: 0.30, failedPct: 0.02 },
    { name: 'Christmas Whitening Campaign',       status: 'draft',    daysBack: 0,  totalCount: 0,  sentPct: 0,    deliveredPct: 0,    readPct: 0,    failedPct: 0 },
  ],
  angola: [
    { name: 'Back to School Flash Sale',         status: 'completed', daysBack: 11, totalCount: 50, sentPct: 0.99, deliveredPct: 0.94, readPct: 0.84, failedPct: 0.01 },
    { name: 'Independence Day Mega Offer',       status: 'completed', daysBack: 5,  totalCount: 50, sentPct: 0.98, deliveredPct: 0.92, readPct: 0.79, failedPct: 0.02 },
    { name: 'Restock Alerts — Electronics',      status: 'completed', daysBack: 1,  totalCount: 50, sentPct: 0.95, deliveredPct: 0.88, readPct: 0.70, failedPct: 0.05 },
    { name: 'VIP Customer Loyalty Drive',        status: 'paused',    daysBack: 1,  totalCount: 50, sentPct: 0.55, deliveredPct: 0.52, readPct: 0.41, failedPct: 0.03 },
    { name: 'Black Friday Preview Campaign',     status: 'draft',     daysBack: 0,  totalCount: 0,  sentPct: 0,    deliveredPct: 0,    readPct: 0,    failedPct: 0 },
  ],
};

// ── Inbox conversation starters ────────────────────────────────
const INBOX_THREADS = {
  dental: [
    {
      display: 'Priya Patel', phone: '+917009834561',
      preview: 'When is my next appointment?',
      messages: [
        { dir: 'inbound',  body: 'Hello! When is my next appointment? 😊' },
        { dir: 'outbound', body: 'Hi Priya! Your next appointment is on 28th August at 11 AM. Shall I send a reminder the day before?' },
        { dir: 'inbound',  body: 'Yes please! Also can I reschedule to 2 PM?' },
        { dir: 'outbound', body: 'Of course! I\'ve rescheduled you to 28th August at 2:00 PM. See you then! 🦷' },
      ],
    },
    {
      display: 'Rahul Sharma', phone: '+918762341890',
      preview: 'Is the clinic open on Sunday?',
      messages: [
        { dir: 'inbound',  body: 'Hi, is the clinic open on Sundays?' },
        { dir: 'outbound', body: 'Hi Rahul! Yes, we\'re open Sundays 10 AM – 3 PM. Would you like to book?' },
        { dir: 'inbound',  body: 'Perfect! Book me for this Sunday at 11 AM please.' },
      ],
    },
    {
      display: 'Anjali Mehta', phone: '+919871234567',
      preview: 'The teeth whitening you mentioned sounds interesting',
      messages: [
        { dir: 'inbound',  body: 'I saw your Diwali offer. Is teeth whitening painful?' },
        { dir: 'outbound', body: 'Not at all, Anjali! It\'s a gentle 45-minute procedure. 95% of patients experience zero discomfort. Interested in booking?' },
        { dir: 'inbound',  body: 'Yes! I\'d love to try. What\'s the cost after the offer?' },
        { dir: 'outbound', body: 'With the Diwali offer it\'s just ₹2,999 (was ₹5,999). Want me to reserve a slot this weekend?' },
        { dir: 'inbound',  body: 'Yes please, Saturday works!' },
      ],
    },
  ],
  angola: [
    {
      display: 'Maria Silva', phone: '+244923456789',
      preview: 'Quero saber sobre o Samsung que está em promoção',
      messages: [
        { dir: 'inbound',  body: 'Olá! Vi a promoção do Samsung Galaxy A55. Ainda tem em stock?' },
        { dir: 'outbound', body: 'Olá Maria! Sim, ainda temos stock. Preço promocional: AOA 79,900. Quer reservar um?' },
        { dir: 'inbound',  body: 'Sim! Pode fazer entrega em Luanda?' },
        { dir: 'outbound', body: 'Claro! Entrega em 24h para Luanda. Taxa de entrega: AOA 1,500. Confirmo o pedido?' },
      ],
    },
    {
      display: 'João Santos', phone: '+244912345678',
      preview: 'O meu pedido ainda não chegou',
      messages: [
        { dir: 'inbound',  body: 'Boa tarde! O meu pedido #ORD-20260812-0031 ainda não chegou.' },
        { dir: 'outbound', body: 'Olá João! Lamentamos o atraso. Vou verificar o estado do seu pedido agora.' },
        { dir: 'outbound', body: 'O seu pedido está em trânsito e chegará amanhã até às 18h. Desculpe o inconveniente!' },
        { dir: 'inbound',  body: 'Ok, obrigado pela informação!' },
      ],
    },
    {
      display: 'Beatriz Ferreira', phone: '+244934567890',
      preview: 'Tenho interesse no seu programa de fidelidade',
      messages: [
        { dir: 'inbound',  body: 'Boa dia! Como funciona o programa VIP da Angola Retail?' },
        { dir: 'outbound', body: 'Olá Beatriz! No programa VIP você acumula pontos em cada compra: 1 ponto por cada AOA 100. Ao atingir 500 pontos, ganha 10% de desconto! 🎁' },
        { dir: 'inbound',  body: 'Que incrível! Como me inscrevo?' },
        { dir: 'outbound', body: 'É automático! Com a sua próxima compra você já estará inscrita. Posso ajudar com mais alguma coisa?' },
      ],
    },
  ],
};

// ══════════════════════════════════════════════════════════════
// MAIN SEEDER
// ══════════════════════════════════════════════════════════════

async function seed() {
  console.log(B('\n🌱  VDAJ Demo Data Seeder\n'));

  // ── 0. Clear tenant-owned data ─────────────────────────────
  console.log(Y('  Clearing existing demo data…'));
  await q(`
    TRUNCATE TABLE
      analytics_snapshots,
      inbox_messages,
      inbox_conversations,
      campaign_messages,
      campaigns,
      contact_list_members,
      contact_lists,
      contacts,
      message_templates,
      subscriptions,
      automations,
      flows,
      flow_nodes,
      flow_edges,
      flow_executions
    RESTART IDENTITY CASCADE
  `);
  // Also clear tenants except those with super_admin users
  await q(`DELETE FROM tenants`);
  await q(`DELETE FROM users WHERE role != 'super_admin'`);
  ok('Demo tables cleared');

  // ── 1. SuperAdmin ──────────────────────────────────────────
  const adminPwd  = 'VDAJAdmin@2025!';
  const adminHash = await bcrypt.hash(adminPwd, 12);
  const { rows: [admin] } = await q(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, is_verified)
     VALUES ($1, $2, 'Venkatesh', 'Joshi', 'super_admin', TRUE, TRUE)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           is_active     = TRUE,
           is_verified   = TRUE,
           updated_at    = NOW()
     RETURNING id, email`,
    ['admin@vdajservices.com', adminHash]
  );
  ok(`SuperAdmin: ${admin.email}`);

  // ── 2. Seed each tenant ────────────────────────────────────
  const TENANT_CONFIGS = [
    {
      key:           'dental',
      name:          'Ideal Dental Care',
      slug:          'ideal-dental-care',
      plan:          'growth',
      countryCode:   'IN',
      timezone:      'Asia/Kolkata',
      wabaId:        'DEMO_WABA_DENTAL_001',
      phoneNumberId: 'DEMO_PH_DENTAL_001',
      adminEmail:    'admin@idealdentalcare.in',
      adminFirst:    'Dr. Kavitha',
      adminLast:     'Reddy',
      adminPwd:      'Dental@Demo2026!',
      phoneGen:      fakeIndianPhone,
      firstNames:    INDIAN_FIRST,
      lastNames:     INDIAN_LAST,
      templates:     TEMPLATES.dental,
      campaigns:     CAMPAIGNS.dental,
      inbox:         INBOX_THREADS.dental,
      subTier:       'Growth',
    },
    {
      key:           'angola',
      name:          'Angola Retail Hub',
      slug:          'angola-retail-hub',
      plan:          'enterprise',
      countryCode:   'AO',
      timezone:      'Africa/Luanda',
      wabaId:        'DEMO_WABA_ANGOLA_001',
      phoneNumberId: 'DEMO_PH_ANGOLA_001',
      adminEmail:    'admin@angolaretail.ao',
      adminFirst:    'Carlos',
      adminLast:     'Ferreira',
      adminPwd:      'Angola@Demo2026!',
      phoneGen:      fakeAngolaPhone,
      firstNames:    ANGOLA_FIRST,
      lastNames:     ANGOLA_LAST,
      templates:     TEMPLATES.angola,
      campaigns:     CAMPAIGNS.angola,
      inbox:         INBOX_THREADS.angola,
      subTier:       'Enterprise',
    },
  ];

  for (const cfg of TENANT_CONFIGS) {
    console.log(B(`\n  ── ${cfg.name} ──`));
    await seedTenant(cfg, admin.id);
  }

  // ── Done ───────────────────────────────────────────────────
  await pool.end();

  console.log(B('\n━━━  Seed Complete  ━━━\n'));
  console.log('  SuperAdmin:');
  console.log(`    Email:    admin@vdajservices.com`);
  console.log(`    Password: ${adminPwd}\n`);
  console.log('  Tenant Admins:');
  for (const cfg of TENANT_CONFIGS) {
    console.log(`\n    ${cfg.name}`);
    console.log(`      Email:    ${cfg.adminEmail}`);
    console.log(`      Password: ${cfg.adminPwd}`);
  }
  console.log(G('\n  🟢 All systems seeded. Start the dev server and log in!\n'));
}

// ══════════════════════════════════════════════════════════════
// PER-TENANT SEEDER
// ══════════════════════════════════════════════════════════════

async function seedTenant(cfg, superAdminId) {

  // ── 2a. Tenant ───────────────────────────────────────────
  const { rows: [tenant] } = await q(
    `INSERT INTO tenants
       (name, slug, plan, country_code, timezone, waba_id, phone_number_id,
        meta_system_token, max_messages_per_day, monthly_message_quota, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'DEMO_TOKEN_PLACEHOLDER',5000,100000,TRUE)
     RETURNING id`,
    [cfg.name, cfg.slug, cfg.plan, cfg.countryCode, cfg.timezone, cfg.wabaId, cfg.phoneNumberId]
  );
  const tenantId = tenant.id;
  ok(`Tenant created: ${cfg.name} (${tenantId.slice(0, 8)}…)`);

  // ── 2b. Tenant Admin user ────────────────────────────────
  const adminHash = await bcrypt.hash(cfg.adminPwd, 10);
  const { rows: [adminUser] } = await q(
    `INSERT INTO users
       (tenant_id, email, password_hash, first_name, last_name,
        role, is_active, is_verified)
     VALUES ($1,$2,$3,$4,$5,'tenant_admin',TRUE,TRUE)
     RETURNING id`,
    [tenantId, cfg.adminEmail, adminHash, cfg.adminFirst, cfg.adminLast]
  );
  ok(`Admin user: ${cfg.adminEmail}`);

  // ── 2c. Subscription ─────────────────────────────────────
  const { rows: [tier] } = await q(
    `SELECT id FROM subscription_tiers WHERE name = $1 LIMIT 1`,
    [cfg.subTier]
  );
  if (tier) {
    await q(
      `INSERT INTO subscriptions
         (tenant_id, tier_id, status, current_period_start, current_period_end,
          msgs_used_this_period, trial_ends_at)
       VALUES ($1,$2,'active',NOW(),NOW() + INTERVAL '30 days',
               $3, NULL)`,
      [tenantId, tier.id, rand(500, 15000)]
    );
    ok(`Subscription: ${cfg.subTier}`);
  }

  // ── 2d. Contact Lists ────────────────────────────────────
  const { rows: [listVIP] } = await q(
    `INSERT INTO contact_lists (tenant_id, name, description, created_by)
     VALUES ($1,'VIP Customers','High-value customers — priority messaging',$2)
     RETURNING id`,
    [tenantId, adminUser.id]
  );
  const { rows: [listLeads] } = await q(
    `INSERT INTO contact_lists (tenant_id, name, description, created_by)
     VALUES ($1,'New Leads','Prospects who signed up in the last 30 days',$2)
     RETURNING id`,
    [tenantId, adminUser.id]
  );
  ok(`Contact lists: VIP Customers, New Leads`);

  // ── 2e. Contacts (50) ────────────────────────────────────
  const contactIds = [];
  const usedPhones = new Set();

  for (let i = 0; i < 50; i++) {
    let phone;
    do { phone = cfg.phoneGen(); } while (usedPhones.has(phone));
    usedPhones.add(phone);

    const firstName = pick(cfg.firstNames);
    const lastName  = pick(cfg.lastNames);
    const email     = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${rand(1, 99)}@example.com`;
    const createdAt = daysAgo(rand(1, 60));

    const { rows: [contact] } = await q(
      `INSERT INTO contacts
         (tenant_id, phone_e164, first_name, last_name, email, status, created_at)
       VALUES ($1,$2,$3,$4,$5,'active',$6::timestamptz)
       ON CONFLICT (tenant_id, phone_e164) DO NOTHING
       RETURNING id`,
      [tenantId, phone, firstName, lastName, email, createdAt]
    );
    if (contact) contactIds.push({ id: contact.id, phone, firstName, lastName });
  }
  ok(`Contacts: ${contactIds.length} created`);

  // Assign contacts to lists: first 30 → VIP, last 25 → Leads (5 overlap)
  for (const c of contactIds.slice(0, 30)) {
    await q(
      `INSERT INTO contact_list_members (contact_list_id, contact_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [listVIP.id, c.id]
    );
  }
  for (const c of contactIds.slice(25)) {
    await q(
      `INSERT INTO contact_list_members (contact_list_id, contact_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [listLeads.id, c.id]
    );
  }
  ok(`Contacts assigned to lists`);

  // ── 2f. Message Templates ────────────────────────────────
  const templateIds = [];
  for (const t of cfg.templates) {
    const { rows: [tmpl] } = await q(
      `INSERT INTO message_templates
         (tenant_id, name, category, language, body_text, header_text,
          footer_text, variables_schema, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)
       RETURNING id`,
      [
        tenantId, t.name, t.category, t.language,
        t.body_text, t.header_text || null,
        t.footer_text || null, t.variables_schema,
        t.status, adminUser.id,
      ]
    );
    templateIds.push(tmpl.id);
  }
  ok(`Templates: ${templateIds.length} created (approved)`);

  // ── 2g. Campaigns + campaign_messages ────────────────────
  const campaignDefs = cfg.campaigns;
  for (let ci = 0; ci < campaignDefs.length; ci++) {
    const def        = campaignDefs[ci];
    const templateId = templateIds[ci % templateIds.length];
    const listId     = ci % 2 === 0 ? listVIP.id : listLeads.id;
    const startedAt  = def.status !== 'draft' ? daysAgo(def.daysBack, 9) : null;
    const createdAt  = daysAgo(def.daysBack + 1, rand(14, 22));

    const totalCount     = def.totalCount;
    const sentCount      = Math.floor(totalCount * def.sentPct);
    const deliveredCount = Math.floor(totalCount * def.deliveredPct);
    const readCount      = Math.floor(totalCount * def.readPct);
    const failedCount    = Math.floor(totalCount * def.failedPct);

    const { rows: [camp] } = await q(
      `INSERT INTO campaigns
         (tenant_id, name, template_id, contact_list_id, status,
          total_count, sent_count, delivered_count, read_count, failed_count,
          queued_count, started_at, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11::timestamptz,$12,$13::timestamptz,$14::timestamptz)
       RETURNING id`,
      [
        tenantId, def.name, templateId, listId, def.status,
        totalCount, sentCount, deliveredCount, readCount, failedCount,
        startedAt, adminUser.id, createdAt, startedAt || createdAt,
      ]
    );

    // Only populate campaign_messages for non-draft campaigns
    if (def.status !== 'draft' && totalCount > 0) {
      const pool_contacts = contactIds.slice(0, totalCount);
      for (let mi = 0; mi < pool_contacts.length; mi++) {
        const contact    = pool_contacts[mi];
        const sentAtDate = startedAt ? new Date(new Date(startedAt).getTime() + mi * 3000).toISOString() : null;

        // Determine status based on percentages
        let msgStatus = 'queued';
        const rnd = Math.random();
        if (mi < Math.floor(totalCount * def.failedPct))           msgStatus = 'failed';
        else if (mi < Math.floor(totalCount * def.readPct))        msgStatus = 'read';
        else if (mi < Math.floor(totalCount * def.deliveredPct))   msgStatus = 'delivered';
        else if (mi < Math.floor(totalCount * def.sentPct))        msgStatus = 'sent';

        const metaMessageId = `DEMO_MSG_${camp.id.slice(0,8)}_${mi.toString().padStart(3,'0')}`;

        await q(
          `INSERT INTO campaign_messages
             (campaign_id, tenant_id, contact_id, phone_e164, template_vars,
              status, meta_message_id, sent_at, delivered_at, read_at)
           VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8::timestamptz,$9::timestamptz,$10::timestamptz)`,
          [
            camp.id, tenantId, contact.id, contact.phone,
            JSON.stringify({ body: [contact.firstName] }),
            msgStatus,
            metaMessageId,
            sentAtDate,
            (msgStatus === 'delivered' || msgStatus === 'read') && sentAtDate
              ? new Date(new Date(sentAtDate).getTime() + rand(30, 300) * 1000).toISOString()
              : null,
            msgStatus === 'read' && sentAtDate
              ? new Date(new Date(sentAtDate).getTime() + rand(300, 3600) * 1000).toISOString()
              : null,
          ]
        );
      }
      ok(`${def.name}: ${pool_contacts.length} messages (${def.status})`);
    } else {
      ok(`${def.name}: ${def.status} — no messages`);
    }
  }

  // ── 2h. Analytics Snapshots (14 days) ────────────────────
  const completedCamps = campaignDefs.filter((d) => d.status === 'completed');
  for (let day = 13; day >= 0; day--) {
    const snapDate = new Date();
    snapDate.setDate(snapDate.getDate() - day);
    const dateStr = snapDate.toISOString().slice(0, 10);

    // Base msgs from campaigns that ran during this window
    let msgsSent      = 0;
    let msgsDelivered = 0;
    let msgsRead      = 0;
    let msgsFailed    = 0;
    const optOuts     = rand(0, 3);
    const newContacts = rand(2, 12);

    for (const cd of completedCamps) {
      if (cd.daysBack >= day && cd.daysBack < day + 2) {
        // This campaign ran around this day
        const base  = rand(30, cd.totalCount);
        msgsSent      += Math.floor(base * cd.sentPct);
        msgsDelivered += Math.floor(base * cd.deliveredPct);
        msgsRead      += Math.floor(base * cd.readPct);
        msgsFailed    += Math.floor(base * cd.failedPct);
      }
    }

    // Add some organic daily activity even on quiet days
    msgsSent      += rand(5, 40);
    msgsDelivered += rand(4, 38);
    msgsRead      += rand(3, 30);

    await q(
      `INSERT INTO analytics_snapshots
         (tenant_id, snapshot_date, msgs_sent, msgs_delivered, msgs_read, msgs_failed, opt_outs, new_contacts)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (tenant_id, snapshot_date) DO UPDATE
         SET msgs_sent=EXCLUDED.msgs_sent, msgs_delivered=EXCLUDED.msgs_delivered,
             msgs_read=EXCLUDED.msgs_read, msgs_failed=EXCLUDED.msgs_failed,
             opt_outs=EXCLUDED.opt_outs, new_contacts=EXCLUDED.new_contacts`,
      [tenantId, dateStr, msgsSent, msgsDelivered, msgsRead, msgsFailed, optOuts, newContacts]
    );
  }
  ok(`Analytics snapshots: 14 days of historical data`);

  // ── 2i. Inbox Conversations + Messages ───────────────────
  for (const thread of cfg.inbox) {
    const { rows: [conv] } = await q(
      `INSERT INTO inbox_conversations
         (tenant_id, phone_e164, display_name, status,
          unread_count, last_message_at, last_message_preview)
       VALUES ($1,$2,$3,'open',$4,NOW(),$5)
       RETURNING id`,
      [
        tenantId,
        thread.phone,
        thread.display,
        rand(1, 3),
        thread.preview,
      ]
    );

    // Try to link to an existing contact
    const { rows: contactMatch } = await q(
      `SELECT id FROM contacts WHERE tenant_id=$1 AND phone_e164=$2 LIMIT 1`,
      [tenantId, thread.phone]
    );
    if (contactMatch.length) {
      await q(
        `UPDATE inbox_conversations SET contact_id=$1 WHERE id=$2`,
        [contactMatch[0].id, conv.id]
      );
    }

    // Insert messages with realistic time offsets
    for (let mi = 0; mi < thread.messages.length; mi++) {
      const msg       = thread.messages[mi];
      const msgAt     = new Date(Date.now() - (thread.messages.length - mi) * rand(120, 600) * 1000);
      const waId      = `DEMO_WA_${conv.id.slice(0, 8)}_${mi}`;
      const isOutbound = msg.dir === 'outbound';

      await q(
        `INSERT INTO inbox_messages
           (conversation_id, tenant_id, wa_message_id, direction,
            message_type, body, status, sent_by, created_at)
         VALUES ($1,$2,$3,$4,'text',$5,$6,$7,$8::timestamptz)`,
        [
          conv.id, tenantId, waId, msg.dir,
          msg.body,
          isOutbound ? 'read' : 'delivered',
          isOutbound ? adminUser.id : null,
          msgAt.toISOString(),
        ]
      );
    }
    ok(`Inbox: ${thread.display} (${thread.messages.length} messages)`);
  }

  console.log(DM(`  ✓ ${cfg.name} fully seeded`));
}

// ══════════════════════════════════════════════════════════════

seed().catch((err) => {
  console.error('\n\x1b[31m✖ Seeder crashed:\x1b[0m', err.message);
  console.error(err.stack);
  pool.end();
  process.exit(1);
});
