import type { CloudVendor } from '@pixelweb/shared';
import { vendorOf } from '@pixelweb/shared/capture';

/**
 * What one cloud's console needs beyond the generic rules in extract.ts. An
 * adapter only says where to look; the reading stays generic. Vendors without
 * one (Huawei Cloud, Azure, GCP) get the generic rules alone.
 */
export interface VendorAdapter {
  /** help icons keep their text in a tooltip that only exists on hover: hover them one by one after reading the page */
  hoverHelp?: boolean;
  /** the page's own help text, kept in the DOM even while its drawer is closed */
  helpPanel?: string;
  /** links beside a label that load that field's help into the panel */
  infoLinks?: string;
}

export const ADAPTERS: Partial<Record<CloudVendor, VendorAdapter>> = {
  // Fusion (next-*): a next-icon-help beside the label, its text in a next-balloon drawn on hover
  aliyun: { hoverHelp: true },
  // Cloudscape (awsui_*): an "Info" link beside the label opens the help panel, which holds the page's help until then
  aws: { helpPanel: '[class*="awsui_help-panel_"]', infoLinks: '[class*="awsui_variant-info"]' },
};

export function adapterFor(hostname: string): VendorAdapter {
  const vendor = vendorOf(hostname);
  return (vendor && ADAPTERS[vendor]) || {};
}
