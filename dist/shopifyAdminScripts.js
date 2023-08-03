"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.megaRewardsTest = exports.addTagsInShopifyAdmin = exports.getCustomerOrderCount = exports.addCountryTagToCustomerInShopify = exports.tagCustomerInShopify = exports.updateShippingAddressInShopify = exports.addBadAddressTags = exports.isSpecificChannelOrder = exports.isWebStoreOrder = exports.isShopPayOrder = exports.isShippingRequired = void 0;
/* eslint-disable max-len */
const axios_1 = __importDefault(require("axios"));
const exponential_backoff_1 = require("exponential-backoff");
const shopifyScripts_1 = require("./shopifyScripts");
// import { cleansedAddress } from '../consumers/remorsePeriodProcessing/useCases/addressValidation/cleanAddress';
const { 
// TAG_BAD_ADDRESS_REPLACED,
TAG_BAD_ADDRESS_NOT_AUTO_FIXABLE, TAG_DO_NOT_PROCESS, SHOPIFY_API_KEY, SHOPIFY_GRAPHQL_URL, STORE_HANDLE, } = process.env;
const isShippingRequired = (shopifyOrder) => {
    const { line_items: lineItems } = shopifyOrder;
    for (const { requires_shipping: requiresShipping } of lineItems) {
        if (requiresShipping) {
            return true;
        }
    }
    return false;
};
exports.isShippingRequired = isShippingRequired;
const isShopPayOrder = (shopifyOrder) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const { data: { handle: channelHandle } } = yield (0, shopifyScripts_1.getChannelInfo)(shopifyOrder.id);
        return channelHandle === 'shop';
    }
    catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        console.debug('isShopPayOrder, err:', err.stack);
        return false;
    }
});
exports.isShopPayOrder = isShopPayOrder;
const isWebStoreOrder = (shopifyOrder) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const { data: { handle: channelHandle } } = yield (0, shopifyScripts_1.getChannelInfo)(shopifyOrder.id);
        return channelHandle === 'web';
    }
    catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        console.debug('isWebStoreOrder, err:', err.stack);
        return false;
    }
});
exports.isWebStoreOrder = isWebStoreOrder;
const isSpecificChannelOrder = (shopifyOrder, channelHandles) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const { data: { handle: channelHandle } } = yield (0, shopifyScripts_1.getChannelInfo)(shopifyOrder.id);
        console.debug('isSpecificChannelOrder debug:', { orderId: shopifyOrder.id, channelHandle: channelHandle });
        return channelHandles.includes(channelHandle);
    }
    catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        console.debug('isSpecificChannelOrder, err:', err.stack);
        return false;
    }
});
exports.isSpecificChannelOrder = isSpecificChannelOrder;
// export const updateAddressAndAddCorrespondingTag = async (
//   shopifyOrder: ShopifyOrderObject,
//   cleanedAddress: cleansedAddress,
// ) => {
//   const { shipping_address: shopifyAddress } = shopifyOrder;
//   shopifyAddress.address1 = cleanedAddress.address1;
//   shopifyAddress.address2 = cleanedAddress.address2;
//   shopifyAddress.city = cleanedAddress.city;
//   shopifyAddress.province_code = cleanedAddress.provinceCode;
//   shopifyAddress.zip = cleanedAddress.zip;
//   shopifyAddress.country_code = cleanedAddress.countryCode;
//   return Promise.all([
//     addTagsInShopifyAdmin(
//       shopifyOrder.admin_graphql_api_id,
//       [TAG_BAD_ADDRESS_REPLACED as string],
//     ),
//     updateShippingAddressInShopify(shopifyOrder),
//   ]);
// };
const addBadAddressTags = (shopifyOrder) => __awaiter(void 0, void 0, void 0, function* () {
    const tagsToAdd = [];
    /**
     * @todo add back DO_NOT_PROCESS tagging for very bad addresses,
     * once have the OK from CX to proceed here (on next deploy).
     */
    tagsToAdd.push(TAG_BAD_ADDRESS_NOT_AUTO_FIXABLE);
    /**
     * @description holding off on freezing EU orders, awaiting phase 2 front-end
     * Loqate layer, as Loqate isn't very reliable for scoring international addresses,
     * when compared to US addresses
     */
    if (STORE_HANDLE !== 'EU') {
        tagsToAdd.push(TAG_DO_NOT_PROCESS);
    }
    return Promise.all([
        (0, exports.addTagsInShopifyAdmin)(shopifyOrder.admin_graphql_api_id, tagsToAdd),
    ]);
});
exports.addBadAddressTags = addBadAddressTags;
const updateShippingAddressInShopify = (shopifyOrder) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, exponential_backoff_1.backOff)(
    // eslint-disable-next-line no-return-await
    () => __awaiter(void 0, void 0, void 0, function* () { return yield updateShippingAddressInShopifyWithoutRetry(shopifyOrder); }), {
        jitter: 'full',
        retry: (err, attemptNumber) => {
            console.error('updateShippingAddressInShopify, retry, error:', err);
            console.error('updateShippingAddressInShopify, retry, attemptNumber:', attemptNumber);
            return true; // keep retrying until (default) numAttempts
        },
    });
});
exports.updateShippingAddressInShopify = updateShippingAddressInShopify;
const updateShippingAddressInShopifyWithoutRetry = (shopifyOrder) => __awaiter(void 0, void 0, void 0, function* () {
    const data = JSON.stringify({
        query: `mutation orderUpdate($input: OrderInput!) {
                orderUpdate(input: $input) {
                  userErrors {
                    field
                    message
                  }
                }
              }`,
        variables: {
            input: {
                id: Buffer.from(`gid://shopify/Order/${shopifyOrder.id}`).toString('base64'),
                shippingAddress: {
                    address1: shopifyOrder.shipping_address.address1,
                    address2: shopifyOrder.shipping_address.address2,
                    city: shopifyOrder.shipping_address.city,
                    provinceCode: shopifyOrder.shipping_address.province_code,
                    zip: shopifyOrder.shipping_address.zip,
                    countryCode: shopifyOrder.shipping_address.country_code,
                },
            },
        },
    });
    const resp = yield (0, axios_1.default)({
        method: 'post',
        url: SHOPIFY_GRAPHQL_URL,
        headers: {
            'X-Shopify-Access-Token': SHOPIFY_API_KEY,
            'Content-Type': 'application/json',
        },
        data,
    });
    const { data: respData } = resp;
    if (respData.errors && Array.isArray(respData.errors) && respData.errors.length > 0) {
        console.error('respData.errors:', JSON.stringify(respData.errors));
        throw new Error(respData.errors[0].message);
    }
    if (respData.data && respData.data.userErrors
        && Array.isArray(respData.data.userErrors)
        && respData.data.userErrors.length > 0) {
        console.error('respData.data.userErrors:', JSON.stringify(respData.data.userErrors));
        throw new Error(respData.data.userErrors[0].message);
    }
});
const tagCustomerInShopify = (shopifyOrder, tags) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, exports.addTagsInShopifyAdmin)(shopifyOrder.customer.admin_graphql_api_id, tags);
});
exports.tagCustomerInShopify = tagCustomerInShopify;
/**
 * @example `de-customer` or `us-customer` tags will be added...
 * Interesting edge case would be a customer that orders for multiple countries...
 * But, 80-20 rule, bro! In terms of time + resources + ROI of pursuing that...
 * I think customers that do weird stuff like that should maybe expect weird behavior, anyways.
 */
const addCountryTagToCustomerInShopify = (shopifyOrder) => __awaiter(void 0, void 0, void 0, function* () {
    const customerCountryTag = `${shopifyOrder.shipping_address.country_code.toLowerCase()}-customer`;
    return (0, exports.addTagsInShopifyAdmin)(shopifyOrder.customer.admin_graphql_api_id, [customerCountryTag]);
});
exports.addCountryTagToCustomerInShopify = addCountryTagToCustomerInShopify;
const getCustomerOrderCount = (shopifyOrder) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, exponential_backoff_1.backOff)(
    // eslint-disable-next-line no-return-await
    () => __awaiter(void 0, void 0, void 0, function* () { return yield getCustomerOrderCountWithoutRetry(shopifyOrder); }), {
        jitter: 'full',
        retry: (err, attemptNumber) => {
            console.error('getCustomerOrderCount, retry, error:', err);
            console.error('getCustomerOrderCount, retry, attemptNumber:', attemptNumber);
            return true; // keep retrying until (default) numAttempts
        },
    });
});
exports.getCustomerOrderCount = getCustomerOrderCount;
const getCustomerOrderCountWithoutRetry = (shopifyOrder) => __awaiter(void 0, void 0, void 0, function* () {
    const data = JSON.stringify({
        query: `{ query: customer(id: "gid://shopify/Customer/${shopifyOrder.customer.id}") {
        numberOfOrders
      }
    }`,
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const resp = yield (0, axios_1.default)({
        method: 'post',
        url: SHOPIFY_GRAPHQL_URL,
        headers: {
            'X-Shopify-Access-Token': SHOPIFY_API_KEY,
            'Content-Type': 'application/json',
        },
        data,
    });
    const { data: respData } = resp;
    if (respData.errors && Array.isArray(respData.errors) && respData.errors.length > 0) {
        console.error('respData.errors:', JSON.stringify(respData.errors));
        throw new Error(respData.errors[0].message);
    }
    if (respData.data && respData.data.userErrors
        && Array.isArray(respData.data.userErrors)
        && respData.data.userErrors.length > 0) {
        console.error('respData.data.userErrors:', JSON.stringify(respData.data.userErrors));
        throw new Error(respData.data.userErrors[0].message);
    }
    return Number(respData.data.query.numberOfOrders);
});
const addTagWithoutRetry = (gid, tags) => __awaiter(void 0, void 0, void 0, function* () {
    if (gid.indexOf('gid://') !== 0) {
        throw new Error(`gid (${gid}) doesn't appear to be a valid gid!`);
    }
    const data = JSON.stringify({
        query: `mutation tagsAdd($id: ID!, $tags: [String!]!) {
                tagsAdd(id: $id, tags: $tags) {
                  userErrors {
                    field
                    message
                  }
                }
              }`,
        variables: {
            id: gid,
            tags,
        },
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const resp = yield (0, axios_1.default)({
        method: 'post',
        url: SHOPIFY_GRAPHQL_URL,
        headers: {
            'X-Shopify-Access-Token': SHOPIFY_API_KEY,
            'Content-Type': 'application/json',
        },
        data,
    });
    const { data: respData } = resp;
    console.debug('addTagsInShopifyAdmin, respData:', JSON.stringify(respData), {
        gid,
        tags,
        requestId: resp.headers['X-Request-ID'],
    });
    if (respData.data.tagsAdd.userErrors.length > 0) {
        console.error('tagsAdd userErrors:', JSON.stringify(respData.data.tagsAdd.userErrors));
        throw new Error(respData.data.tagsAdd.userErrors[0].message);
    }
});
/**
 * @description note that each tag is silently truncated to max len of 40,
 * else Shopify would error on adding all tags
 */
const addTagsInShopifyAdmin = (gid, tags) => __awaiter(void 0, void 0, void 0, function* () {
    return (0, exponential_backoff_1.backOff)(
    // eslint-disable-next-line no-return-await
    () => __awaiter(void 0, void 0, void 0, function* () { return yield addTagWithoutRetry(gid, tags.map(tag => tag.substring(0, 40))); }), {
        jitter: 'full',
        retry: (err, attemptNumber) => {
            console.error('addTagsInShopifyAdmin, retry, error:', err);
            console.error('addTagsInShopifyAdmin, retry, attemptNumber:', attemptNumber);
            return true; // keep retrying until (default) numAttempts
        },
    });
});
exports.addTagsInShopifyAdmin = addTagsInShopifyAdmin;
const megaRewardsTest = (shopifyOrder) => __awaiter(void 0, void 0, void 0, function* () {
    console.debug('entered into test case');
    const resp = yield (0, axios_1.default)({
        method: 'post',
        url: 'https://0uvw7m1obg.execute-api.us-east-1.amazonaws.com/dev/trigger',
        headers: {
            'Content-Type': 'application/json',
        },
        data: shopifyOrder,
    });
    console.debug(resp);
});
exports.megaRewardsTest = megaRewardsTest;
// const addNote = (shopifyOrder: ShopifyOrderObject, cleanedAddress: cleansedAddress) => {
//   // eslint-disable-next-line no-param-reassign
//   shopifyOrder.note = typeof shopifyOrder.note !== 'string' ? '' : shopifyOrder.note;
//   // eslint-disable-next-line no-param-reassign
//   shopifyOrder.note = `${shopifyOrder.note}
//   address-validation-service suggested address:
//   ${JSON.stringify(cleanedAddress)}`;
// };
