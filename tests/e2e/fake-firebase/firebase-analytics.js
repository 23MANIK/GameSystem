// Fake Analytics: events are kept in window.__analyticsEvents for the tests to read.
window.__analyticsEvents = window.__analyticsEvents || [];
export async function isSupported() { return true; }
export function getAnalytics() { return {}; }
export function setUserId() {}
export function logEvent(a, name, params) { window.__analyticsEvents.push({ name, params }); }
