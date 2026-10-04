import type { CloudVendor, PageCapture } from './index.js';

/** What a hidden value is replaced with. */
export const MASK: string;
export const VENDOR_NAMES: Record<CloudVendor, string>;
export function vendorOf(hostname: string): CloudVendor | null;
export function redactText(text: string): { text: string; count: number };
export function isSecretLabel(label: string): boolean;
export function cleanUrl(url: string): { url: string; count: number };
export function redactCapture(capture: PageCapture): PageCapture;
