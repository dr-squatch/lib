import { ShopifyOrderObject } from './types/shopify';
export declare const getCustomerOrderCount: (shopifyOrder: ShopifyOrderObject) => Promise<number>;
export declare const isSpecificChannelOrder: (shopifyOrder: ShopifyOrderObject, channelHandles: string[]) => Promise<boolean>;
export declare const tagCustomerInShopify: (shopifyOrder: ShopifyOrderObject, tags: string[]) => Promise<void>;
export declare const addTagsInShopifyAdmin: (gid: string, tags: string[]) => Promise<void>;
