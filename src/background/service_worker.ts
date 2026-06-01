import { clearSession } from '../lib/session';

chrome.runtime.onSuspend.addListener(() => { clearSession(); });
