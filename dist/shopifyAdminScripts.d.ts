import { ShopifyOrderObject } from './types/shopify';
export declare const isShippingRequired: (shopifyOrder: ShopifyOrderObject) => boolean;
export declare const isShopPayOrder: (shopifyOrder: ShopifyOrderObject) => Promise<boolean>;
export declare const isWebStoreOrder: (shopifyOrder: ShopifyOrderObject) => Promise<boolean>;
export declare const isSpecificChannelOrder: (shopifyOrder: ShopifyOrderObject, channelHandles: string[]) => Promise<boolean>;
export declare const addBadAddressTags: (shopifyOrder: ShopifyOrderObject, prefix: string) => Promise<[void]>;
export declare const updateShippingAddressInShopify: (shopifyOrder: ShopifyOrderObject, prefix: string) => Promise<void>;
export declare const tagCustomerInShopify: (shopifyOrder: ShopifyOrderObject, tags: string[], prefix: string) => Promise<void>;
/**
 * @example `de-customer` or `us-customer` tags will be added...
 * Interesting edge case would be a customer that orders for multiple countries...
 * But, 80-20 rule, bro! In terms of time + resources + ROI of pursuing that...
 * I think customers that do weird stuff like that should maybe expect weird behavior, anyways.
 */
export declare const addCountryTagToCustomerInShopify: (shopifyOrder: ShopifyOrderObject, prefix: string) => Promise<void>;
export declare const getCustomerOrderCount: (shopifyOrder: ShopifyOrderObject, prefix: string) => Promise<number>;
/**
 * @description note that each tag is silently truncated to max len of 40,
 * else Shopify would error on adding all tags
 */
export declare const addTagsInShopifyAdmin: (gid: string, tags: string[], prefix: string) => Promise<void>;
export declare const megaRewardsTest: (shopifyOrder: ShopifyOrderObject, prefix: string) => Promise<void>;
