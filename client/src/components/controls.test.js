jest.mock('axios', () => { const api = { interceptors: { request: { use: () => {} } }, get: jest.fn(), post: jest.fn() }; return { create: () => api, __testApi: api }; });
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../App';
import AIReport from './AIReport';
import AIWorkspace, { workspaceFields, workspacePresets } from './AIWorkspace';
import axios from 'axios';
global.IS_REACT_ACT_ENVIRONMENT = true;

const fixture = { result_json: {
  summary: { eligible: false, adjustment: 0, note: '' },
  findings: [{ category: 'Income', amount: 0 }, { category: 'Credit', amount: 1200 }],
  next_steps: ['Check documents', 'Confirm filing status'],
} };

test('returned and saved JSON render labeled nested values, lists, and tables', () => {
  for (const response of [fixture, { id: 17, result: '{}', ...fixture }]) {
    const html = renderToStaticMarkup(<AIReport response={response} title="Fixture report" />);
    expect(html).toContain('Summary');
    expect(html).toContain('Eligible');
    expect(html).toContain('No');
    expect(html).toContain('Adjustment');
    expect(html).toContain('0');
    expect(html).toContain('(empty string)');
    expect(html).toContain('<table');
    expect(html).toContain('Next steps');
    expect(html).toContain('Check documents');
    expect(html).not.toContain('&quot;eligible&quot;');
  }
});

test('workspace examples fill all ten editable fields', () => {
  const presets = workspacePresets({ title: 'Quarterly payment planning', samples: [] });
  expect(presets.length).toBeGreaterThan(1);
  for (const preset of presets) {
    expect(Object.keys(preset.values).sort()).toEqual(workspaceFields.map((field) => field.key).sort());
    for (const field of workspaceFields) expect(preset.values[field.key]).toBeTruthy();
  }
});

test('demo fill button does not submit when client credentials are absent', async () => {
  window.history.replaceState({}, '', '/login');
  localStorage.clear();
  const rootNode = document.createElement('div');
  document.body.appendChild(rootNode);
  const root = createRoot(rootNode);
  await act(async () => { root.render(<App />); });
  const button = [...rootNode.querySelectorAll('button')].find((item) => item.textContent === 'Fill demo credentials');
  expect(button).toBeTruthy();
  await act(async () => { button.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  expect(rootNode.textContent).toContain('Demo credentials are unavailable');
  expect(rootNode.querySelector('input[type="email"]').value).toBe('');
  expect(rootNode.querySelector('input[type="password"]').value).toBe('');
  expect(localStorage.getItem('token')).toBeNull();
  await act(async () => root.unmount());
  rootNode.remove();
});

test('native estimated payment preset fills optional input without generation and keeps real tax year', async () => {
  axios.__testApi.get.mockImplementation((url) => Promise.resolve({ data: url === '/tax-years' ? [{ id: 77, year: 2025 }] : { id: 4, email: 'fixture@example.test' } }));
  axios.__testApi.post.mockClear();
  window.history.replaceState({}, '', '/estimated-payments-ai');
  localStorage.setItem('token', 'fixture-token');
  const node = document.createElement('div'); document.body.appendChild(node);
  const root = createRoot(node);
  await act(async () => { root.render(<App />); });
  const preset = [...node.querySelectorAll('button')].find((button) => button.textContent === 'Annualized income');
  expect(preset).toBeTruthy();
  await act(async () => { preset.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  expect(node.querySelector('select option[value="77"]').selected).toBe(true);
  expect([...node.querySelectorAll('select')].some((select) => select.value === 'annualized')).toBe(true);
  expect(node.querySelector('input[type="number"]').value).toBe('150000');
  expect(axios.__testApi.post).not.toHaveBeenCalled();
  await act(async () => root.unmount()); node.remove(); localStorage.clear();
});

test('configured demo button fills fields without signing in', async () => {
  const previousEmail = process.env.REACT_APP_DEMO_EMAIL;
  const previousPassword = process.env.REACT_APP_DEMO_PASSWORD;
  process.env.REACT_APP_DEMO_EMAIL = 'demo.fixture@example.test';
  process.env.REACT_APP_DEMO_PASSWORD = 'fixture-only-password';
  axios.__testApi.post.mockClear();
  window.history.replaceState({}, '', '/login'); localStorage.clear();
  const node = document.createElement('div'); document.body.appendChild(node);
  const root = createRoot(node);
  try {
    await act(async () => { root.render(<App />); });
    const button = [...node.querySelectorAll('button')].find((item) => item.textContent === 'Fill demo credentials');
    await act(async () => { button.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(node.querySelector('input[type="email"]').value).toBe(process.env.REACT_APP_DEMO_EMAIL);
    expect(node.querySelector('input[type="password"]').value).toBe(process.env.REACT_APP_DEMO_PASSWORD);
    expect(axios.__testApi.post).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount()); node.remove();
    if (previousEmail === undefined) delete process.env.REACT_APP_DEMO_EMAIL; else process.env.REACT_APP_DEMO_EMAIL = previousEmail;
    if (previousPassword === undefined) delete process.env.REACT_APP_DEMO_PASSWORD; else process.env.REACT_APP_DEMO_PASSWORD = previousPassword;
  }
});

test('saved history opens a readable report detail', async () => {
  const item = { id: 17, created_at: '2026-01-01T00:00:00Z', model: 'fixture', input: { goal: 'Review quarterly tax' }, ...fixture };
  const previousFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [item] }) });
  const node = document.createElement('div'); document.body.appendChild(node);
  const root = createRoot(node);
  try {
    await act(async () => { root.render(<AIWorkspace feature={{ id: 'fixture/history', title: 'Fixture', samples: [] }} token="fixture" />); });
    const row = node.querySelector('.ai-history-row');
    expect(row).toBeTruthy();
    await act(async () => { row.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(document.querySelector('.ai-workspace-modal .ai-report')).toBeTruthy();
    expect(document.querySelector('.ai-workspace-modal').textContent).toContain('Eligible');
    expect(document.querySelector('.ai-workspace-modal').textContent).toContain('(empty string)');
  } finally {
    await act(async () => root.unmount()); node.remove(); global.fetch = previousFetch;
  }
});

test.each([
  ['/state-tax-optimize', 'California resident', (node) => expect(node.querySelector('input[placeholder="e.g. CA, TX, NY"]').value).toBe('CA')],
  ['/yoy-anomaly', 'Income decrease', (node) => {
    const summaries = [...node.querySelectorAll('textarea')].map((area) => JSON.parse(area.value));
    expect(summaries).toHaveLength(2);
    expect(summaries[0].agi).toBe(120000);
    expect(summaries[1].itemized).toBe(false);
  }],
  ['/filing-scenario-compare', 'Household status', (node) => {
    expect(node.querySelector('input[placeholder="e.g. spouse student loan interest"]').value).toContain('dependent');
    expect([...node.querySelectorAll('input[type="checkbox"]')].map((input) => input.checked)).toEqual([true, false, false, true]);
  }],
])('native preset on %s fills controlled fields without submitting', async (path, label, verify) => {
  axios.__testApi.get.mockImplementation((url) => Promise.resolve({ data: url === '/tax-years' ? [{ id: 77, year: 2025 }] : { id: 4 } }));
  axios.__testApi.post.mockClear();
  window.history.replaceState({}, '', path); localStorage.setItem('token', 'fixture-token');
  const node = document.createElement('div'); document.body.appendChild(node);
  const root = createRoot(node);
  try {
    await act(async () => { root.render(<App />); });
    const preset = [...node.querySelectorAll('button')].find((button) => button.textContent === label);
    expect(preset).toBeTruthy();
    await act(async () => { preset.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    verify(node);
    expect(node.querySelector('select option[value="77"]').selected).toBe(true);
    expect(axios.__testApi.post).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); node.remove(); localStorage.clear(); }
});

test.each([
  ['/ai-chat', 'Compare the standard and itemized deduction', (node) => {
    expect(node.querySelector('input[placeholder="Ask a tax question..."]').value).toContain('standard and itemized');
  }],
  ['/deduction-finder', 'Student', (node) => {
    expect([...node.querySelectorAll('input[type="checkbox"]')].map((input) => input.checked)).toEqual([false, false, true, false, true, true]);
  }],
  ['/tax-planning', 'Joint retirement', (node) => {
    expect([...node.querySelectorAll('input[type="number"]')].map((input) => input.value)).toEqual(['165000', '53']);
    expect(node.querySelector('select.form-select[value]')?.value || [...node.querySelectorAll('select')].find((select) => select.value === 'married_filing_jointly')?.value).toBe('married_filing_jointly');
  }],
  ['/scan-document', '1099-NEC', (node) => {
    expect([...node.querySelectorAll('select')].some((select) => select.value === '1099-NEC')).toBe(true);
    expect(node.querySelector('input[type="file"]').files).toHaveLength(0);
    expect(node.textContent).toContain('Upload a genuine document before scanning.');
  }],
])('additional native preset on %s fills without generation', async (path, label, verify) => {
  axios.__testApi.get.mockImplementation((url) => Promise.resolve({ data: url === '/tax-years' ? [{ id: 77, year: 2025 }] : [] }));
  axios.__testApi.post.mockClear();
  window.history.replaceState({}, '', path); localStorage.setItem('token', 'fixture-token');
  const node = document.createElement('div'); document.body.appendChild(node);
  const root = createRoot(node);
  try {
    await act(async () => { root.render(<App />); });
    const preset = [...node.querySelectorAll('button')].find((button) => button.textContent.includes(label));
    expect(preset).toBeTruthy();
    await act(async () => { preset.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    verify(node);
    expect([...node.querySelectorAll('select')].some((select) => select.value === '77')).toBe(true);
    expect(axios.__testApi.post).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); node.remove(); localStorage.clear(); }
});

test('project-configured demo credentials fill without submitting', async () => {
  const fs = require('fs');
  const dotenv = require('dotenv');
  const configured = dotenv.parse(fs.readFileSync(require('path').resolve(process.cwd(), '../.env')));
  const demoEmail = configured.DEMO_EMAIL;
  const demoPassword = configured.DEMO_PASSWORD;
  expect(Boolean(demoEmail && demoPassword)).toBe(true);
  const previousEmail = process.env.REACT_APP_DEMO_EMAIL;
  const previousPassword = process.env.REACT_APP_DEMO_PASSWORD;
  process.env.REACT_APP_DEMO_EMAIL = demoEmail;
  process.env.REACT_APP_DEMO_PASSWORD = demoPassword;
  axios.__testApi.post.mockClear();
  window.history.replaceState({}, '', '/login'); localStorage.clear();
  const node = document.createElement('div'); document.body.appendChild(node);
  const root = createRoot(node);
  try {
    await act(async () => { root.render(<App />); });
    const button = [...node.querySelectorAll('button')].find((item) => item.textContent === 'Fill demo credentials');
    await act(async () => { button.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(node.querySelector('input[type="email"]').value === demoEmail).toBe(true);
    expect(node.querySelector('input[type="password"]').value === demoPassword).toBe(true);
    expect(axios.__testApi.post).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount()); node.remove();
    if (previousEmail === undefined) delete process.env.REACT_APP_DEMO_EMAIL; else process.env.REACT_APP_DEMO_EMAIL = previousEmail;
    if (previousPassword === undefined) delete process.env.REACT_APP_DEMO_PASSWORD; else process.env.REACT_APP_DEMO_PASSWORD = previousPassword;
  }
});

test('estimated tax modal preset fills both optional fields without calculation', async () => {
  axios.__testApi.get.mockImplementation((url) => Promise.resolve({ data: url === '/tax-years' ? [{ id: 77, year: 2025 }] : [] }));
  axios.__testApi.post.mockClear();
  window.history.replaceState({}, '', '/estimated-taxes'); localStorage.setItem('token', 'fixture-token');
  const node = document.createElement('div'); document.body.appendChild(node);
  const root = createRoot(node);
  try {
    await act(async () => { root.render(<App />); });
    await act(async () => { [...node.querySelectorAll('button')].find((button) => button.textContent === '+ Calculate Estimates').click(); });
    await act(async () => { [...node.querySelectorAll('button')].find((button) => button.textContent === 'Self employment').click(); });
    expect([...node.querySelectorAll('.modal input[type="number"]')].map((input) => input.value)).toEqual(['145000', '28000']);
    expect([...node.querySelectorAll('select')].some((select) => select.value === '77')).toBe(true);
    expect(axios.__testApi.post).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); node.remove(); localStorage.clear(); }
});

test('utilities presets fill their independent inputs without calling services', async () => {
  axios.__testApi.get.mockImplementation((url) => Promise.resolve({ data: url === '/tax-years' ? [{ id: 77, year: 2025 }] : [] }));
  axios.__testApi.post.mockClear();
  window.history.replaceState({}, '', '/backlog-tools'); localStorage.setItem('token', 'fixture-token');
  const node = document.createElement('div'); document.body.appendChild(node);
  const root = createRoot(node);
  try {
    await act(async () => { root.render(<App />); });
    await act(async () => { [...node.querySelectorAll('button')].find((button) => button.textContent === 'utilities').click(); });
    await act(async () => { [...node.querySelectorAll('button')].find((button) => button.textContent === 'Donation note').click(); });
    await act(async () => { [...node.querySelectorAll('button')].find((button) => button.textContent === 'Three options').click(); });
    expect(node.querySelectorAll('textarea')[0].value).toContain('Charitable contribution receipt');
    expect(JSON.parse(node.querySelectorAll('textarea')[1].value).scenarios).toHaveLength(3);
    expect(axios.__testApi.post).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); node.remove(); localStorage.clear(); }
});

test('chat renders returned structured JSON as labeled facts', async () => {
  axios.__testApi.get.mockImplementation((url) => Promise.resolve({ data: url === '/tax-years' ? [{ id: 77, year: 2025 }] : [] }));
  axios.__testApi.post.mockResolvedValue({ data: { response: JSON.stringify(fixture.result_json) } });
  window.history.replaceState({}, '', '/ai-chat'); localStorage.setItem('token', 'fixture-token');
  const node = document.createElement('div'); document.body.appendChild(node);
  const root = createRoot(node);
  try {
    await act(async () => { root.render(<App />); });
    await act(async () => { [...node.querySelectorAll('button')].find((button) => button.textContent.includes('standard and itemized deduction')).click(); });
    await act(async () => { [...node.querySelectorAll('button')].find((button) => button.textContent === 'Send').click(); });
    const report = node.querySelector('.ai-report');
    expect(report).toBeTruthy();
    expect(report.textContent).toContain('Eligible');
    expect(report.textContent).toContain('(empty string)');
    expect(report.querySelector('table')).toBeTruthy();
  } finally { await act(async () => root.unmount()); node.remove(); localStorage.clear(); }
});

test('document preset preserves a genuinely selected upload', async () => {
  axios.__testApi.get.mockImplementation((url) => Promise.resolve({ data: url === '/tax-years' ? [{ id: 77, year: 2025 }] : [] }));
  axios.__testApi.post.mockClear();
  window.history.replaceState({}, '', '/scan-document'); localStorage.setItem('token', 'fixture-token');
  const originalCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = jest.fn(() => 'blob:fixture');
  const node = document.createElement('div'); document.body.appendChild(node);
  const root = createRoot(node);
  try {
    await act(async () => { root.render(<App />); });
    const upload = node.querySelector('input[type="file"]');
    const file = new File(['fixture content'], 'sample.pdf', { type: 'application/pdf' });
    Object.defineProperty(upload, 'files', { configurable: true, value: [file] });
    await act(async () => { upload.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => { [...node.querySelectorAll('button')].find((button) => button.textContent === 'Receipt').click(); });
    expect(upload.files[0]).toBe(file);
    expect([...node.querySelectorAll('select')].some((select) => select.value === 'Receipt')).toBe(true);
    expect(axios.__testApi.post).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); node.remove(); localStorage.clear(); URL.createObjectURL = originalCreateObjectURL; }
});

test('workspace preset buttons fill every editable field without generating', async () => {
  const previousFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
  const node = document.createElement('div'); document.body.appendChild(node);
  const root = createRoot(node);
  try {
    await act(async () => { root.render(<AIWorkspace feature={{ id: 'fixture/presets', title: 'Tax review', samples: [] }} token="fixture" />); });
    for (const preset of workspacePresets({ title: 'Tax review', samples: [] })) {
      await act(async () => { [...node.querySelectorAll('.ai-preset-bar button')].find((button) => button.textContent === preset.label).click(); });
      expect([...node.querySelectorAll('.ai-form-grid input, .ai-form-grid select, .ai-form-grid textarea')]).toHaveLength(workspaceFields.length);
      expect([...node.querySelectorAll('.ai-form-grid input, .ai-form-grid select, .ai-form-grid textarea')].every((field) => field.value.trim())).toBe(true);
    }
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][1].method).toBeUndefined();
  } finally { await act(async () => root.unmount()); node.remove(); global.fetch = previousFetch; }
});
